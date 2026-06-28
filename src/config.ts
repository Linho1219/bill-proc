import { INCOME, EXPENSE, TRANSFER, LOAN, RawRec } from "@/types.ts";
import {
  TransferSubcategory,
  LoanSubcategory,
  ReimbursementState,
  Currency,
} from "@/types.ts";
import { ProcessMethod } from "@/types.ts";

const account = "同济校园卡";

function expense(rec: RawRec) {
  return {
    type: EXPENSE as typeof EXPENSE,
    time: rec.time,
    amount: -rec.amount,
    account,
  };
}

function meal(rec: RawRec) {
  const hr = rec.time.getHours();
  return {
    category: "正餐",
    subcategory: hr < 10 ? "早餐" : hr < 16 ? "午餐" : "晚餐",
  };
}

function drink() {
  return {
    category: "零嘴",
    subcategory: "饮品",
  };
}

function snack() {
  return {
    category: "零嘴",
    subcategory: "零食",
  };
}

const processors: ProcessMethod[] = [
  {
    // 充值
    match: ({ amount }) => amount > 0 && amount % 10000 === 0,
    process: (rec) => ({
      type: TRANSFER,
      time: rec.time,
      amount: rec.amount,
      from: "中行借记卡",
      to: account,
      subcategory: TransferSubcategory.normal,
    }),
  },
  {
    // 学校补助
    match: ({ amount }) => amount > 0,
    process: (rec) => ({
      type: INCOME,
      time: rec.time,
      amount: rec.amount,
      account,
      subcategory: "福利补贴",
      remark: "补助",
    }),
  },
  {
    // 宿舍电费
    match: ({ place }) => place === "四平路校区电控",
    process: (rec) => ({
      ...expense(rec),
      category: "生活",
      subcategory: "水电费",
    }),
  },
  {
    // 嘉定班车
    match: ({ place }) => place.includes("班车"),
    process: (rec) => ({
      ...expense(rec),
      category: "交通",
      subcategory: "公共交通",
      shop: "班车",
    }),
  },
  {
    // 澡堂
    squeeze: true,
    match: ({ place }) => place.includes("浴室"),
    maxTimeDiff: 1000 * 60 * 60,
    process: (recs) => {
      const amount = -recs.reduce((acc, rec) => acc + rec.amount, 0);
      return {
        type: EXPENSE,
        time: recs.at(-1)!.time,
        amount,
        account,
        category: "生活",
        subcategory: "水电费",
        shop: "西南八浴室",
      };
    },
  },
  {
    // 教育超市买零食
    // 全部判定为零食，因为生活用品都是上网买的
    match: ({ place }) => place.includes("超市"),
    process: (rec) => ({
      ...expense(rec),
      ...snack(),
      shop: "教育超市",
    }),
  },
  {
    // 面包房买饮料
    match: ({ place, amount }) => place.includes("西点") && amount >= -380,
    process: (rec) => ({
      ...expense(rec),
      ...snack(),
      shop: "面包房",
    }),
  },
  {
    // 肯德基
    match: ({ place }) => place.includes("肯德基"),
    process: (rec) => ({
      ...expense(rec),
      ...(-rec.amount <= 1200 ? snack() : meal(rec)),
      shop: "肯德基",
    }),
  },
  {
    // 西苑食堂特判
    // 因为不仅有正餐，还有奶茶，水果捞和烧烤
    match: ({ place, pos }) => place === "四平路校区西苑广场小炒部",
    process: (rec) => {
      let remark: string | undefined;
      const categories = ((pos) => {
        if (pos === 44) return drink();
        if (pos === 40)
          return {
            category: "正餐",
            subcategory: "水果",
          };
        if (pos === 54) {
          remark = "烧烤";
          return {
            category: "零嘴",
            subcategory: "夜宵",
          };
        }
        return meal(rec);
      })(rec.pos);
      return {
        ...expense(rec),
        ...categories,
        shop: "西苑食堂",
        remark,
      };
    },
  },
  {
    match: ({ place }) =>
      place.includes("广场") ||
      place.includes("余庆堂") ||
      place.includes("余香食集") ||
      place.includes("食堂") ||
      place.includes("西点"),
    process: (rec) => {
      const shop = ((place) => {
        if (place.includes("西点4")) return "面包房";
        if (place.includes("西苑")) return "西苑食堂";
        if (place.includes("南苑")) return "南苑食堂";
        if (place.includes("小北苑")) return "小北苑食堂";
        if (place.includes("北苑")) return "北苑食堂";
        if (place.includes("学苑")) return "学苑食堂";
        if (place.includes("余庆堂") || place.includes("余香食集"))
          return "余香食集";
      })(rec.place);
      return {
        ...expense(rec),
        ...meal(rec),
        shop,
      };
    },
  },
];

export default processors;
