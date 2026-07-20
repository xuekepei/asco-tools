import { z } from "zod";

const nonNegativeInteger = z.coerce.number().int().min(0).max(999_999_999_999);

export const monthEntrySchema = z.object({
  month: z.string(),
  regularWorkers: nonNegativeInteger,
  regularWages: nonNegativeInteger,
  officerWorkers: nonNegativeInteger,
  officerWages: nonNegativeInteger,
  temporaryWorkers: nonNegativeInteger,
  temporaryWages: nonNegativeInteger,
  insuredWorkers: nonNegativeInteger,
  insuredWages: nonNegativeInteger,
  insuredOfficerWorkers: nonNegativeInteger,
  insuredOfficerWages: nonNegativeInteger,
});

const officerDetailSchema = z.object({
  name: z.string().trim().max(100),
  position: z.string().trim().max(100),
  employmentInsured: z.boolean(),
});

export const employmentRatesByBusinessType = {
  general: { finalized: 14.5, estimated: 13.5 },
  agriculture: { finalized: 16.5, estimated: 15.5 },
  construction: { finalized: 17.5, estimated: 16.5 },
} as const;

export const declarationSchema = z.object({
  fiscalYear: z.coerce.number().int().min(2020).max(2100),
  businessName: z.string().trim().max(255),
  postalCode: z.string().trim().max(12),
  address: z.string().trim().max(500),
  phone: z.string().trim().max(30),
  laborInsuranceNumber: z.string().trim().max(30),
  workDescription: z.string().trim().max(500).default(""),
  incomingSecondedWorkers: nonNegativeInteger.default(0),
  outgoingSecondedWorkers: nonNegativeInteger.default(0),
  businessType: z.enum(["general", "agriculture", "construction"]),
  workersCompRate: z.coerce.number().min(0).max(100),
  finalizedEmploymentRate: z.coerce.number().min(0).max(100),
  estimatedEmploymentRate: z.coerce.number().min(0).max(100),
  generalContributionRate: z.coerce.number().min(0).max(1),
  alreadyPaidEstimatedPremium: nonNegativeInteger,
  installments: z.union([z.literal(1), z.literal(3)]),
  refundHandling: z
    .enum(["apply_then_refund", "refund_all"])
    .default("apply_then_refund"),
  allocationTarget: z
    .enum(["labor", "contribution", "both"])
    .default("labor"),
  months: z.array(monthEntrySchema).length(12),
  bonusEntries: z.array(monthEntrySchema).length(3),
  officerDetails: z.array(officerDetailSchema).length(5),
});

export const businessSectionSchema = declarationSchema
  .pick({
    fiscalYear: true,
    businessName: true,
    businessType: true,
  })
  .extend({
    businessName: z
      .string()
      .trim()
      .min(1, "事業の名称を入力してください")
      .max(255),
  });

export type MonthEntry = z.infer<typeof monthEntrySchema>;
export type OfficerDetail = z.infer<typeof officerDetailSchema>;
export type DeclarationInput = z.infer<typeof declarationSchema>;

export const monthLabels = [
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
  "1月",
  "2月",
  "3月",
] as const;

export function createEmptyDeclaration(): DeclarationInput {
  return {
    fiscalYear: 2026,
    businessName: "",
    postalCode: "",
    address: "",
    phone: "",
    laborInsuranceNumber: "",
    workDescription: "",
    incomingSecondedWorkers: 0,
    outgoingSecondedWorkers: 0,
    businessType: "general",
    workersCompRate: 3,
    finalizedEmploymentRate: 14.5,
    estimatedEmploymentRate: 13.5,
    generalContributionRate: 0.02,
    alreadyPaidEstimatedPremium: 0,
    installments: 1,
    refundHandling: "apply_then_refund",
    allocationTarget: "labor",
    months: monthLabels.map((month) => ({
      month,
      regularWorkers: 0,
      regularWages: 0,
      officerWorkers: 0,
      officerWages: 0,
      temporaryWorkers: 0,
      temporaryWages: 0,
      insuredWorkers: 0,
      insuredWages: 0,
      insuredOfficerWorkers: 0,
      insuredOfficerWages: 0,
    })),
    bonusEntries: Array.from({ length: 3 }, (_, index) => ({
      month: `賞与${index + 1}`,
      regularWorkers: 0,
      regularWages: 0,
      officerWorkers: 0,
      officerWages: 0,
      temporaryWorkers: 0,
      temporaryWages: 0,
      insuredWorkers: 0,
      insuredWages: 0,
      insuredOfficerWorkers: 0,
      insuredOfficerWages: 0,
    })),
    officerDetails: Array.from({ length: 5 }, () => ({
      name: "",
      position: "",
      employmentInsured: false,
    })),
  };
}

export function normalizeDeclaration(value: unknown): DeclarationInput {
  const empty = createEmptyDeclaration();
  const raw = value && typeof value === "object" ? value : {};
  const candidate = raw as Partial<DeclarationInput>;
  return declarationSchema.parse({
    ...empty,
    ...candidate,
    months: Array.isArray(candidate.months) ? candidate.months : empty.months,
    bonusEntries: Array.isArray(candidate.bonusEntries)
      ? candidate.bonusEntries
      : empty.bonusEntries,
    officerDetails: Array.isArray(candidate.officerDetails)
      ? candidate.officerDetails
      : empty.officerDetails,
  });
}

function roundDownToThousands(yen: number) {
  return Math.floor(yen / 1_000) * 1_000;
}

function premium(baseYen: number, ratePerThousand: number) {
  return Math.floor((baseYen * ratePerThousand) / 1_000);
}

export function calculateDeclaration(input: DeclarationInput) {
  const wageEntries = [...input.months, ...input.bonusEntries];
  const totals = wageEntries.reduce(
    (sum, month) => {
      sum.workersCompPeople +=
        month.regularWorkers + month.officerWorkers + month.temporaryWorkers;
      sum.workersCompWages +=
        month.regularWages + month.officerWages + month.temporaryWages;
      sum.employmentPeople += month.insuredWorkers + month.insuredOfficerWorkers;
      sum.employmentWages += month.insuredWages + month.insuredOfficerWages;
      return sum;
    },
    {
      workersCompPeople: 0,
      workersCompWages: 0,
      employmentPeople: 0,
      employmentWages: 0,
    },
  );

  const workersCompBase = roundDownToThousands(totals.workersCompWages);
  const employmentBase = roundDownToThousands(totals.employmentWages);
  const finalizedWorkersComp = premium(workersCompBase, input.workersCompRate);
  const finalizedEmployment = premium(
    employmentBase,
    input.finalizedEmploymentRate,
  );
  const isCombinedInsurance =
    workersCompBase > 0 &&
    employmentBase > 0 &&
    workersCompBase === employmentBase;
  const finalizedPremium = isCombinedInsurance
    ? premium(
        workersCompBase,
        input.workersCompRate + input.finalizedEmploymentRate,
      )
    : finalizedWorkersComp + finalizedEmployment;
  const estimatedWorkersComp = premium(workersCompBase, input.workersCompRate);
  const estimatedEmployment = premium(
    employmentBase,
    input.estimatedEmploymentRate,
  );
  const estimatedPremium = isCombinedInsurance
    ? premium(
        workersCompBase,
        input.workersCompRate + input.estimatedEmploymentRate,
      )
    : estimatedWorkersComp + estimatedEmployment;
  const generalContribution = premium(
    workersCompBase,
    input.generalContributionRate,
  );
  const settlement = finalizedPremium - input.alreadyPaidEstimatedPremium;
  const shortfall = Math.max(0, settlement);
  const overpayment = Math.max(0, -settlement);
  const installmentThreshold = isCombinedInsurance ? 400_000 : 200_000;
  const canUseInstallments = estimatedPremium >= installmentThreshold;
  const installmentCount =
    input.installments === 3 && canUseInstallments ? 3 : 1;
  const baseInstallment = Math.floor(estimatedPremium / installmentCount);
  const estimatedInstallmentAmounts = Array.from(
    { length: installmentCount },
    (_, index) =>
    index === 0
      ? baseInstallment +
        (estimatedPremium - baseInstallment * installmentCount)
      : baseInstallment,
  );

  const payableInstallmentAmounts = [...estimatedInstallmentAmounts];
  let contributionDue = generalContribution;
  let remainingCredit =
    input.refundHandling === "apply_then_refund" ? overpayment : 0;
  const applyToInstallment = (index: number) => {
    const applied = Math.min(remainingCredit, payableInstallmentAmounts[index]);
    payableInstallmentAmounts[index] -= applied;
    remainingCredit -= applied;
  };
  const applyToContribution = () => {
    const applied = Math.min(remainingCredit, contributionDue);
    contributionDue -= applied;
    remainingCredit -= applied;
  };

  if (input.allocationTarget === "contribution") {
    applyToContribution();
  } else if (input.allocationTarget === "both") {
    applyToInstallment(0);
    applyToContribution();
    for (let index = 1; index < installmentCount; index += 1) {
      applyToInstallment(index);
    }
  } else {
    for (let index = 0; index < installmentCount; index += 1) {
      applyToInstallment(index);
    }
  }

  payableInstallmentAmounts[0] += contributionDue + shortfall;
  const creditApplied =
    input.refundHandling === "apply_then_refund"
      ? overpayment - remainingCredit
      : 0;
  const refundable = overpayment - creditApplied;
  const payableTotal = payableInstallmentAmounts.reduce(
    (sum, amount) => sum + amount,
    0,
  );
  const averageWorkers =
    totals.workersCompPeople > 0
      ? Math.max(1, Math.floor(totals.workersCompPeople / 12))
      : 0;
  const averageEmploymentInsured =
    totals.employmentPeople > 0
      ? Math.max(1, Math.floor(totals.employmentPeople / 12))
      : 0;

  return {
    ...totals,
    workersCompBase,
    employmentBase,
    finalizedWorkersComp,
    finalizedEmployment,
    finalizedPremium,
    estimatedWorkersComp,
    estimatedEmployment,
    estimatedPremium,
    generalContribution,
    settlement,
    shortfall,
    overpayment,
    creditApplied,
    payableTotal,
    refundable,
    isCombinedInsurance,
    installmentThreshold,
    canUseInstallments,
    averageWorkers,
    averageEmploymentInsured,
    estimatedInstallmentAmounts,
    payableInstallmentAmounts,
    installmentAmounts: payableInstallmentAmounts,
  };
}

export type DeclarationResult = ReturnType<typeof calculateDeclaration>;

export type DeclarationAnomaly = {
  severity: "info" | "warning";
  title: string;
  detail: string;
  month?: string;
};

export function detectDeclarationAnomalies(
  input: DeclarationInput,
): DeclarationAnomaly[] {
  const anomalies: DeclarationAnomaly[] = [];
  const result = calculateDeclaration(input);

  if (!input.businessName.trim()) {
    anomalies.push({
      severity: "warning",
      title: "事業名称が未入力です",
      detail: "保存・出力前に申告書どおりの名称を入力してください。",
    });
  }
  if (!input.laborInsuranceNumber.trim()) {
    anomalies.push({
      severity: "info",
      title: "労働保険番号を確認してください",
      detail: "現在は未入力です。お手元の申告書と照合してください。",
    });
  } else if (!/^\d{2}-\d-\d{2}-\d{6}-\d{3}$/.test(input.laborInsuranceNumber)) {
    anomalies.push({
      severity: "info",
      title: "労働保険番号の形式を確認してください",
      detail: "「00-0-00-000000-000」の形式で入力してください。",
    });
  }

  const expectedRates = employmentRatesByBusinessType[input.businessType];
  if (
    input.finalizedEmploymentRate !== expectedRates.finalized ||
    input.estimatedEmploymentRate !== expectedRates.estimated
  ) {
    anomalies.push({
      severity: "warning",
      title: "雇用保険率が事業区分の標準値と異なります",
      detail: `選択した事業区分の標準値は確定 ${expectedRates.finalized}、概算 ${expectedRates.estimated}（千分率）です。最新の公式料率も確認してください。`,
    });
  }

  [...input.months, ...input.bonusEntries].forEach((month) => {
    const workersCompPeople =
      month.regularWorkers + month.officerWorkers + month.temporaryWorkers;
    const workersCompWages =
      month.regularWages + month.officerWages + month.temporaryWages;
    if (workersCompPeople > 0 && workersCompWages === 0) {
      anomalies.push({
        severity: "warning",
        title: "人数に対して賃金が0円です",
        detail: "労災保険対象者の賃金入力が漏れていないか確認してください。",
        month: month.month,
      });
    }
    if (workersCompPeople === 0 && workersCompWages > 0) {
      anomalies.push({
        severity: "warning",
        title: "賃金に対して人数が0人です",
        detail: "人数または賃金の入力先が正しいか確認してください。",
        month: month.month,
      });
    }
    const average = workersCompPeople > 0 ? workersCompWages / workersCompPeople : 0;
    if (average > 5_000_000) {
      anomalies.push({
        severity: "warning",
        title: "1人あたり賃金が大きく見えます",
        detail: "桁や月次集計の範囲を再確認してください。",
        month: month.month,
      });
    }
  });

  if (result.employmentWages > result.workersCompWages) {
    anomalies.push({
      severity: "warning",
      title: "雇用保険対象賃金が労災保険対象賃金を上回っています",
      detail: "対象者区分または入力欄が正しいか確認してください。",
    });
  }
  if (input.installments === 3 && !result.canUseInstallments) {
    anomalies.push({
      severity: "warning",
      title: "3回分納の基準額に達していません",
      detail: "現在の概算保険料では一括納付として計算されます。",
    });
  }

  return anomalies;
}
