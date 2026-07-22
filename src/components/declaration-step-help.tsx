import { BookOpenText, Languages } from "lucide-react";

export type HelpLanguage = "ja" | "zh" | "en";
export type HelpSection = "business" | "wages" | "rates" | "review";

type HelpItem = {
  label: string;
  description: string;
  example: string;
};

type HelpContent = {
  title: string;
  intro: string;
  exampleLabel: string;
  items: HelpItem[];
};

const languageLabels: Record<HelpLanguage, string> = {
  ja: "日本語",
  zh: "中文",
  en: "English",
};

const helpFieldKeys: Record<HelpSection, string[]> = {
  business: ["fiscalYear", "businessType", "businessName", "laborInsuranceNumber", "contact", "workDescription", "secondedWorkers"],
  wages: ["regularWorkers", "officerWorkers", "temporaryWorkers", "insuredWorkers", "bonuses"],
  rates: ["workersCompRate", "employmentRates", "generalContributionRate", "alreadyPaidEstimatedPremium", "installments", "refundHandling"],
  review: ["reviewBusiness", "reviewWages", "reviewRates", "reviewPayment", "reviewExport"],
};

const originalFieldLabels: Record<string, string> = {
  fiscalYear: "年度更新対象年度",
  businessType: "事業の種類",
  businessName: "事業の名称",
  laborInsuranceNumber: "労働保険番号",
  contact: "電話番号・郵便番号・事業の所在地",
  workDescription: "具体的な業務又は作業の内容",
  secondedWorkers: "出向者（受入）・出向者（送出）",
  regularWorkers: "常用 人数・賃金",
  officerWorkers: "役員 人数・賃金",
  temporaryWorkers: "臨時 人数・賃金",
  insuredWorkers: "雇用被保険者 人数・賃金",
  bonuses: "賞与 人数・賃金",
  workersCompRate: "労災保険率",
  employmentRates: "雇用保険率（確定・概算）",
  generalContributionRate: "一般拠出金率",
  alreadyPaidEstimatedPremium: "申告済概算保険料額",
  installments: "納付回数",
  refundHandling: "還付・充当の処理・充当先",
  reviewBusiness: "事業情報",
  reviewWages: "算定基礎額・保険料内訳",
  reviewRates: "保険料率",
  reviewPayment: "納付見込額",
  reviewExport: "ファイル出力",
};

const helpContent: Record<HelpLanguage, Record<HelpSection, HelpContent>> = {
  ja: {
    business: {
      title: "事業情報の入力ガイド",
      intro: "申告書や労働保険番号が分かる書類をお手元に用意して入力してください。",
      exampleLabel: "記入例",
      items: [
        { label: "年度更新対象年度", description: "申告対象となる年度を西暦4桁で入力します。", example: "2026" },
        { label: "事業の種類", description: "事業内容に該当する区分を選択します。選択した区分に応じて雇用保険率の初期値が設定されます。", example: "一般の事業" },
        { label: "事業の名称", description: "申告書に記載された正式な事業所名を入力します。", example: "株式会社サンプル 東京事業所" },
        { label: "労働保険番号", description: "11桁の番号を申告書どおり、区切り記号を含めて入力します。", example: "13-1-01-123456-789" },
        { label: "連絡先・所在地", description: "申告書に記載する電話番号、郵便番号、事業所の所在地を入力します。", example: "03-1234-5678 ／ 100-0001 ／ 東京都千代田区…" },
        { label: "具体的な業務内容", description: "主な製品、サービス、作業内容が分かるよう簡潔に記載します。", example: "スポーツ施設の運営および会員管理業務" },
        { label: "出向者", description: "受入は他社から来ている人数、送出は自社から他社へ出している人数です。該当がなければ0人です。", example: "受入 2人 ／ 送出 1人" },
      ],
    },
    wages: {
      title: "賃金集計の入力ガイド",
      intro: "対象年度の賃金台帳を確認し、4月から翌年3月まで月ごとに入力してください。",
      exampleLabel: "記入例",
      items: [
        { label: "常用 人数・賃金", description: "常時使用する労働者の人数と、その月に支払った労災保険対象賃金です。", example: "人数 8人 ／ 賃金 2,400,000円" },
        { label: "役員 人数・賃金", description: "労働者として扱う役員がいる場合のみ入力します。", example: "人数 1人 ／ 賃金 350,000円" },
        { label: "臨時 人数・賃金", description: "アルバイトや日雇いなど、臨時に使用した労働者分を入力します。", example: "人数 3人 ／ 賃金 180,000円" },
        { label: "雇用被保険者", description: "雇用保険の被保険者となる人数と対象賃金を入力します。", example: "人数 7人 ／ 賃金 2,100,000円" },
        { label: "賞与", description: "対象年度中に支給した賞与を、支給月ごとに入力します。支給がなければ0です。", example: "7月賞与 3,200,000円" },
      ],
    },
    rates: {
      title: "料率・納付設定ガイド",
      intro: "申告書と最新の公式料率表を照合して入力してください。料率は千分率です。",
      exampleLabel: "記入例",
      items: [
        { label: "労災保険率", description: "事業の種類に対応する労災保険率を入力します。", example: "3.0 / 1,000" },
        { label: "雇用保険率", description: "確定分と概算分それぞれの料率を入力します。", example: "確定 14.5 ／ 概算 13.5" },
        { label: "一般拠出金率", description: "一般拠出金の料率を千分率で入力します。", example: "0.02 / 1,000" },
        { label: "申告済概算保険料額", description: "前年度の申告時に計上した概算保険料額を入力します。", example: "420,000円" },
        { label: "納付回数", description: "分納条件を満たす場合は3回納付を選択できます。", example: "一括納付" },
        { label: "還付・充当", description: "過納額がある場合に、次期保険料へ充当するか全額還付するかを選びます。", example: "充当を優先（残額は還付）" },
      ],
    },
    review: {
      title: "確認・出力ガイド",
      intro: "計算結果を申告書と照合してからPDFまたはExcelを出力してください。",
      exampleLabel: "確認例",
      items: [
        { label: "事業情報", description: "事業名称、年度、労働保険番号に誤りがないか確認します。", example: "名称と番号が申告書と一致" },
        { label: "算定基礎額", description: "賃金台帳の年間合計と大きな差がないか確認します。", example: "労災対象賃金 28,800,000円" },
        { label: "保険料率", description: "選択した事業区分と適用年度の公式料率を再確認します。", example: "一般の事業・2026年度" },
        { label: "納付見込額", description: "確定、概算、充当、還付の各金額を確認します。", example: "納付見込額 398,200円" },
        { label: "ファイル出力", description: "申告書1件につき初回の出力時のみ出力回数を1回消費します。同じ申告書はPDF・Excelとも何度でも再出力できます。", example: "初回のみ1回消費 → 再出力は無料" },
      ],
    },
  },
  zh: {
    business: {
      title: "事业信息填写指南",
      intro: "请准备年度更新申告书以及能够确认劳动保险编号的资料。",
      exampleLabel: "填写示例",
      items: [
        { label: "年度更新对象年度", description: "用四位数字填写本次申报对应的年度。", example: "2026" },
        { label: "事业类型", description: "选择符合实际业务内容的类型，系统会据此设置雇用保险费率初始值。", example: "一般事业" },
        { label: "事业名称", description: "填写申告书上记载的正式事业所名称。", example: "株式会社サンプル 東京事業所" },
        { label: "劳动保险编号", description: "按照申告书填写，并保留编号中的分隔符。", example: "13-1-01-123456-789" },
        { label: "联系方式及所在地", description: "填写申告书上的电话号码、邮政编码和事业所地址。", example: "03-1234-5678／100-0001／东京都千代田区…" },
        { label: "具体业务内容", description: "简要说明主要产品、服务或者实际工作内容。", example: "体育设施运营及会员管理业务" },
        { label: "派驻人员", description: "接收是其他公司派到本公司的人数；派出是本公司派往其他公司的人数。没有则填0。", example: "接收 2人／派出 1人" },
      ],
    },
    wages: {
      title: "工资汇总填写指南",
      intro: "请对照工资台账，按4月至次年3月逐月填写。",
      exampleLabel: "填写示例",
      items: [
        { label: "正式员工人数及工资", description: "填写常用劳动者人数和当月属于劳灾保险对象的工资。", example: "8人／2,400,000日元" },
        { label: "董事人数及工资", description: "仅在董事同时被视为劳动者时填写。", example: "1人／350,000日元" },
        { label: "临时员工人数及工资", description: "填写兼职、日雇等临时劳动者的数据。", example: "3人／180,000日元" },
        { label: "雇用保险参保人员", description: "填写雇用保险被保险者人数和对应工资。", example: "7人／2,100,000日元" },
        { label: "奖金", description: "按发放月份填写年度内发放的奖金，没有则填0。", example: "7月奖金 3,200,000日元" },
      ],
    },
    rates: {
      title: "费率及缴纳设置指南",
      intro: "请对照申告书与最新官方费率表。这里的费率单位为千分率。",
      exampleLabel: "填写示例",
      items: [
        { label: "劳灾保险费率", description: "填写与事业类型对应的劳灾保险费率。", example: "3.0 / 1,000" },
        { label: "雇用保险费率", description: "分别填写确定部分和概算部分的费率。", example: "确定 14.5／概算 13.5" },
        { label: "一般分担金费率", description: "按千分率填写一般分担金费率。", example: "0.02 / 1,000" },
        { label: "已申报概算保险费", description: "填写上一年度申报时计算的概算保险费。", example: "420,000日元" },
        { label: "缴纳次数", description: "满足分期条件时可以选择分3次缴纳。", example: "一次性缴纳" },
        { label: "退款及抵扣", description: "存在多缴金额时，选择优先抵扣下一期保险费或全部退款。", example: "优先抵扣（余额退款）" },
      ],
    },
    review: {
      title: "确认及导出指南",
      intro: "请将计算结果与申告书核对后，再导出PDF或Excel。",
      exampleLabel: "确认示例",
      items: [
        { label: "事业信息", description: "确认事业名称、年度和劳动保险编号是否正确。", example: "名称和编号与申告书一致" },
        { label: "计算基础金额", description: "确认与工资台账的年度合计不存在明显差异。", example: "劳灾对象工资 28,800,000日元" },
        { label: "保险费率", description: "再次确认事业类型和适用年度对应的官方费率。", example: "一般事业・2026年度" },
        { label: "预计缴纳金额", description: "确认确定、概算、抵扣和退款的金额。", example: "预计缴纳 398,200日元" },
        { label: "文件导出", description: "每份申告书只在首次导出时消耗1次额度，之后无论PDF还是Excel都可免费重复导出。", example: "首次消耗1次 → 重复导出免费" },
      ],
    },
  },
  en: {
    business: {
      title: "Business information guide",
      intro: "Have your annual renewal form and labor insurance documents ready before you begin.",
      exampleLabel: "Example",
      items: [
        { label: "Renewal year", description: "Enter the applicable year using four digits.", example: "2026" },
        { label: "Business type", description: "Select the category that matches the business. Initial employment insurance rates are set from this choice.", example: "General business" },
        { label: "Business name", description: "Enter the official workplace name shown on the filing form.", example: "Sample Co., Ltd. Tokyo Office" },
        { label: "Labor insurance number", description: "Copy the number from the form, including separators.", example: "13-1-01-123456-789" },
        { label: "Contact and address", description: "Enter the telephone number, postal code, and workplace address used on the filing form.", example: "03-1234-5678 / 100-0001 / Chiyoda-ku, Tokyo" },
        { label: "Business activities", description: "Briefly describe the main services, products, or work performed.", example: "Sports facility operations and member services" },
        { label: "Seconded workers", description: "Incoming means workers sent to you by another company; outgoing means your workers sent elsewhere. Enter 0 if none.", example: "Incoming 2 / outgoing 1" },
      ],
    },
    wages: {
      title: "Wage entry guide",
      intro: "Use the wage ledger to enter monthly figures from April through the following March.",
      exampleLabel: "Example",
      items: [
        { label: "Regular workers", description: "Enter the worker count and workers' compensation wages paid that month.", example: "8 workers / ¥2,400,000" },
        { label: "Officers", description: "Enter officers only when they are also treated as workers.", example: "1 worker / ¥350,000" },
        { label: "Temporary workers", description: "Include part-time, daily, and other temporary workers.", example: "3 workers / ¥180,000" },
        { label: "Employment-insured workers", description: "Enter the number of insured workers and their eligible wages.", example: "7 workers / ¥2,100,000" },
        { label: "Bonuses", description: "Enter bonuses by payment month. Enter 0 when none were paid.", example: "July bonus ¥3,200,000" },
      ],
    },
    rates: {
      title: "Rates and payment guide",
      intro: "Check the filing form and the latest official rate table. Rates are entered per thousand.",
      exampleLabel: "Example",
      items: [
        { label: "Workers' compensation rate", description: "Enter the rate applicable to the business category.", example: "3.0 / 1,000" },
        { label: "Employment insurance rates", description: "Enter both finalized and estimated rates.", example: "Finalized 14.5 / estimated 13.5" },
        { label: "General contribution rate", description: "Enter the general contribution rate per thousand.", example: "0.02 / 1,000" },
        { label: "Previously declared estimate", description: "Enter the estimated premium declared in the previous filing.", example: "¥420,000" },
        { label: "Payment frequency", description: "Three installments are available when the threshold is met.", example: "Single payment" },
        { label: "Refund and credit", description: "When there is an overpayment, choose whether to apply it to the next premium or refund it in full.", example: "Apply first, refund the remainder" },
      ],
    },
    review: {
      title: "Review and export guide",
      intro: "Compare the result with the filing form before exporting a PDF or Excel file.",
      exampleLabel: "Check example",
      items: [
        { label: "Business information", description: "Confirm the business name, year, and labor insurance number.", example: "Name and number match the form" },
        { label: "Assessment base", description: "Check that the annual total is consistent with the wage ledger.", example: "Eligible wages ¥28,800,000" },
        { label: "Insurance rates", description: "Confirm the official rates for the business type and year.", example: "General business / FY2026" },
        { label: "Estimated amount due", description: "Review finalized, estimated, credit, and refund amounts.", example: "Estimated amount due ¥398,200" },
        { label: "File export", description: "Each declaration consumes one credit on its first export only. Re-exports of the same declaration (PDF or Excel) are free.", example: "First export uses 1 credit → re-exports free" },
      ],
    },
  },
};

export function DeclarationStepHelp({ section, language, onLanguageChange }: { section: HelpSection; language: HelpLanguage; onLanguageChange: (language: HelpLanguage) => void }) {
  const content = helpContent[language][section];
  return (
    <aside className="panel h-fit overflow-hidden xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
      <div className="border-b border-[#e5eae5] bg-[#f8faf7] p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e5f0e7] text-[#25654c]"><BookOpenText size={19} /></span>
          <div><h2 className="font-semibold">{content.title}</h2><p className="mt-1 text-xs leading-5 text-[#738078]">{content.intro}</p></div>
        </div>
        <div className="mt-4 flex items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-[#dfe5df]" aria-label="Help language">
          <Languages className="mx-1 text-[#6f7c74]" size={15} />
          {(Object.keys(languageLabels) as HelpLanguage[]).map((item) => <button key={item} type="button" className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${language === item ? "bg-[#174c3c] text-white" : "text-[#66736b] hover:bg-[#f0f4f0]"}`} aria-pressed={language === item} onClick={() => onLanguageChange(item)}>{languageLabels[item]}</button>)}
        </div>
      </div>
      <div className="space-y-3 p-4">
        {content.items.map((item, index) => {
          const helpKey = helpFieldKeys[section][index];
          return <div key={helpKey} data-help-key={helpKey} tabIndex={0} className="help-linked rounded-2xl border border-[#e8ede9] bg-white p-4 outline-none"><p className="text-xs font-semibold text-[#2e765a]">{originalFieldLabels[helpKey]}</p>{language !== "ja" && <h3 className="mt-1.5 text-sm font-semibold text-[#2b4035]">{item.label}</h3>}<p className="mt-2 text-xs leading-5 text-[#6e7b73]">{item.description}</p><div className="help-example mt-3 rounded-xl bg-[#eef5ed] px-3 py-2 text-xs leading-5 text-[#315d49]"><span className="font-semibold">{content.exampleLabel}：</span>{item.example}</div></div>;
        })}
      </div>
    </aside>
  );
}
