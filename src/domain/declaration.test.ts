import { describe, expect, it } from "vitest";

import {
  businessSectionSchema,
  calculateDeclaration,
  createEmptyDeclaration,
  detectDeclarationAnomalies,
  normalizeDeclaration,
} from "./declaration";

describe("businessSectionSchema", () => {
  it("rejects an empty required business name", () => {
    const input = createEmptyDeclaration();

    const result = businessSectionSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ["businessName"],
          message: "事業の名称を入力してください",
        }),
      );
    }
  });

  it("accepts the initial step after the business name is entered", () => {
    const input = createEmptyDeclaration();
    input.businessName = "株式会社サンプル";

    expect(businessSectionSchema.safeParse(input).success).toBe(true);
  });
});

describe("calculateDeclaration", () => {
  it("aggregates the 12 months and rounds bases down to 1,000 yen", () => {
    const input = createEmptyDeclaration();
    input.months[0].regularWorkers = 2;
    input.months[0].regularWages = 1_234_567;
    input.months[0].insuredWorkers = 2;
    input.months[0].insuredWages = 1_000_999;

    const result = calculateDeclaration(input);

    expect(result.workersCompBase).toBe(1_234_000);
    expect(result.employmentBase).toBe(1_000_000);
    expect(result.finalizedWorkersComp).toBe(3_702);
    expect(result.finalizedEmployment).toBe(14_500);
  });

  it("only permits three installments when estimated premium is high enough", () => {
    const input = createEmptyDeclaration();
    input.installments = 3;
    input.months[0].regularWages = 30_000_000;
    input.months[0].insuredWages = 30_000_000;

    const result = calculateDeclaration(input);

    expect(result.canUseInstallments).toBe(true);
    expect(result.installmentAmounts).toHaveLength(3);
    expect(result.installmentAmounts.reduce((a, b) => a + b, 0)).toBe(
      result.payableTotal,
    );
  });

  it("includes the three bonus rows in wages and the calculation base", () => {
    const input = createEmptyDeclaration();
    input.bonusEntries[0].regularWorkers = 2;
    input.bonusEntries[0].regularWages = 1_234_999;

    const result = calculateDeclaration(input);

    expect(result.workersCompWages).toBe(1_234_999);
    expect(result.workersCompBase).toBe(1_234_000);
  });

  it("uses the combined rate before rounding when both calculation bases match", () => {
    const input = createEmptyDeclaration();
    input.workersCompRate = 3.7;
    input.finalizedEmploymentRate = 14.5;
    input.months[0].regularWages = 1_001_000;
    input.months[0].insuredWages = 1_001_000;

    const result = calculateDeclaration(input);

    expect(result.finalizedWorkersComp + result.finalizedEmployment).toBe(18_217);
    expect(result.finalizedPremium).toBe(18_218);
    expect(result.isCombinedInsurance).toBe(true);
  });

  it("uses the 200,000 yen installment threshold for single-insurance data", () => {
    const input = createEmptyDeclaration();
    input.installments = 3;
    input.months[0].regularWages = 70_000_000;

    const result = calculateDeclaration(input);

    expect(result.isCombinedInsurance).toBe(false);
    expect(result.installmentThreshold).toBe(200_000);
    expect(result.canUseInstallments).toBe(true);
  });

  it("puts the non-installable general contribution into the first term", () => {
    const input = createEmptyDeclaration();
    input.installments = 3;
    input.alreadyPaidEstimatedPremium = 525_000;
    input.months[0].regularWages = 30_000_000;
    input.months[0].insuredWages = 30_000_000;

    const result = calculateDeclaration(input);

    expect(result.shortfall).toBe(0);
    expect(result.generalContribution).toBe(600);
    expect(result.payableInstallmentAmounts[0]).toBe(
      result.estimatedInstallmentAmounts[0] + 600,
    );
    expect(result.payableInstallmentAmounts[1]).toBe(
      result.estimatedInstallmentAmounts[1],
    );
  });

  it("supports refunding an overpayment without applying it", () => {
    const input = createEmptyDeclaration();
    input.refundHandling = "refund_all";
    input.alreadyPaidEstimatedPremium = 100_000;
    input.months[0].regularWages = 1_000_000;

    const result = calculateDeclaration(input);

    expect(result.creditApplied).toBe(0);
    expect(result.refundable).toBe(97_000);
    expect(result.payableTotal).toBe(
      result.estimatedPremium + result.generalContribution,
    );
  });
});

describe("detectDeclarationAnomalies", () => {
  it("flags a month where workers exist but wages are missing", () => {
    const input = createEmptyDeclaration();
    input.businessName = "テスト事業所";
    input.laborInsuranceNumber = "00-0-00-000000-000";
    input.months[0].regularWorkers = 3;

    const anomalies = detectDeclarationAnomalies(input);

    expect(anomalies).toContainEqual(
      expect.objectContaining({ month: "4月", title: "人数に対して賃金が0円です" }),
    );
  });

  it("returns no anomaly for a consistent minimal input", () => {
    const input = createEmptyDeclaration();
    input.businessName = "テスト事業所";
    input.laborInsuranceNumber = "00-0-00-000000-000";

    expect(detectDeclarationAnomalies(input)).toEqual([]);
  });

  it("flags employment rates that do not match the workbook business category", () => {
    const input = createEmptyDeclaration();
    input.businessName = "テスト事業所";
    input.laborInsuranceNumber = "00-0-00-000000-000";
    input.businessType = "construction";

    expect(detectDeclarationAnomalies(input)).toContainEqual(
      expect.objectContaining({
        title: "雇用保険率が事業区分の標準値と異なります",
      }),
    );
  });
});

describe("normalizeDeclaration", () => {
  it("opens legacy drafts by adding fields introduced after they were saved", () => {
    const current = createEmptyDeclaration();
    const legacy = { ...current } as Record<string, unknown>;
    delete legacy.bonusEntries;
    delete legacy.officerDetails;
    delete legacy.refundHandling;

    const normalized = normalizeDeclaration(legacy);

    expect(normalized.bonusEntries).toHaveLength(3);
    expect(normalized.officerDetails).toHaveLength(5);
    expect(normalized.refundHandling).toBe("apply_then_refund");
  });
});
