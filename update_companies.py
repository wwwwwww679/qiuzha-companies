#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""每日更新秋招企业库：调用 DeepSeek API 联网搜索最近 1-2 天新开放的 2027 届秋招，
追加到 companies.json（按公司名去重），并写 meta.json。
无论是否有新增，每次运行都会把检查日期写入 meta.json 的 last_checked 字段。"""
import json, os, sys, urllib.request, urllib.error, datetime, re

API_URL = "https://api.deepseek.com/chat/completions"
MODEL = "deepseek-chat"
KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()

HERE = os.path.dirname(os.path.abspath(__file__))
COMP_PATH = os.path.join(HERE, "companies.json")
META_PATH = os.path.join(HERE, "meta.json")

FIELDS = ["n", "type", "industry", "recruit", "target", "city", "roles",
          "status", "update", "deadline", "link", "notice", "written", "size", "note"]


def log(*a):
    print("[update]", *a, flush=True)


def load_existing():
    try:
        with open(COMP_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        log("读取现有 companies.json 失败:", e)
        return []


def call_deepseek(existing_names, today):
    prompt = (
        "你是招聘情报助手。请联网查找今天或最近1-2天内**正式开放**了2027届秋招/校招的企业。\n\n"
        "⚠️ 严格规则（违反的条目会被删除，请务必遵守）：\n"
        "1) 只输出 JSON 对象，不要任何解释文字，格式：{\"new\":[...]}。\n"
        "2) 只能列入**已在其官网招聘页上正式发布2027届校招公告**的企业。\n"
        "   禁止列入以下情况：仅出现在第三方招聘汇总网站/公众号推文/大学就业网上但官网未确认的；\n"
        "   HR在社交平台口头提到但无正式公告的；往年招过但今年公告尚未发布的。\n"
        "3) link 字段必须是该企业**官网校招页的真实地址**（你能通过联网搜索直接打开确认的）。\n"
        "   禁止编造链接、禁止用公司首页代替校招页、禁止用第三方招聘平台链接代替官网。\n"
        "   如果无法在官网找到校招入口，link 留空字符串 \"\"，同时在 note 里注明\"官网校招入口未确认\"。\n"
        "4) 只列真正的企业（有实际业务、有一定知名度），不要列皮包公司、只有3-5人的微型创业团队。\n"
        "5) target 必须是 \"2027届\"；如果企业面向多个届别但含2027届可以列入，不含则不列。\n"
        "6) 以下公司已经存在，不要再列出：" + "、".join(existing_names) + "。\n"
        "7) 如果没有发现符合以上所有条件的新企业，输出 {\"new\":[]}——宁可漏报，不要虚报。\n\n"
        "字段说明（与之前相同）：n(公司名), type(互联网/科技硬件/金融/医药医疗/汽车/外企/事业单位/民企), "
        "industry(行业), recruit(校招/秋招/秋招提前批), target(填\"2027届\"), city(工作城市), "
        "roles(岗位字符串数组), status(固定\"未投递\"), update(填\"" + today + "\"), "
        "deadline(截止日期YYYY-MM-DD，未知填\"待公布\"), link(官网校招链接), "
        "notice(公告链接，可留空\"\"), written(笔试情况，可填\"待定\"), size(公司规模，可留空\"\"), "
        "note(可填备注信息，如\"仅博士\"/\"官网入口待确认\"等)。\n"
    )
    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": "你只输出 JSON，不做解释。"},
            {"role": "user", "content": prompt}
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def parse_new(text):
    try:
        obj = json.loads(text)
    except Exception:
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            return []
        try:
            obj = json.loads(m.group(0))
        except Exception:
            return []
    arr = obj.get("new") if isinstance(obj, dict) else []
    if not isinstance(arr, list):
        return []
    out = []
    for it in arr:
        if not isinstance(it, dict) or not it.get("n"):
            continue
        rec = {}
        for f in FIELDS:
            v = it.get(f, "")
            if f == "roles" and not isinstance(v, list):
                v = [str(v)] if v else []
            rec[f] = v
        if not rec.get("update"):
            rec["update"] = datetime.date.today().strftime("%Y-%m-%d")
        if not rec.get("status"):
            rec["status"] = "未投递"
        out.append(rec)
    return out


def write_meta(existing, checked_date):
    dates = sorted((c.get("update", "") for c in existing if c.get("update")))
    meta = {
        "updated": dates[-1] if dates else checked_date,
        "last_checked": checked_date,
        "count": len(existing),
        "source": "秋招自习室企业库",
    }
    try:
        with open(META_PATH, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=0)
    except Exception as e:
        log("写 meta.json 失败:", e)


def main():
    today = datetime.date.today().strftime("%Y-%m-%d")
    existing = load_existing()
    existing_names = set((c.get("n", "") for c in existing))
    log("现有企业数:", len(existing))
    if not KEY:
        log("缺少 DEEPSEEK_API_KEY，跳过更新。")
        write_meta(existing, today)
        sys.exit(0)
    try:
        raw = call_deepseek(sorted(existing_names), today)
    except Exception as e:
        log("调用 DeepSeek 失败:", e)
        write_meta(existing, today)
        sys.exit(0)
    new_list = parse_new(raw)
    added = [c for c in new_list if c.get("n") and c["n"] not in existing_names]
    if not added:
        log("今日无新增企业。")
        write_meta(existing, today)
        sys.exit(0)
    existing.extend(added)
    with open(COMP_PATH, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=0)
    write_meta(existing, today)
    log("已新增 %d 家企业，当前共 %d 家。" % (len(added), len(existing)))


if __name__ == "__main__":
    main()
