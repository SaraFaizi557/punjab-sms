/**
 * Public (government-style) vs Private school sector.
 * `settings.schoolSector` is set at admin registration; `schoolType` stays compatible with Settings.
 */

export const SCHOOL_SECTOR = {
  PUBLIC: "Public",
  PRIVATE: "Private",
};

export const PUBLIC_FEE_AMOUNT = 20;
export const PRIVATE_DEFAULT_MONTHLY = 2500;

export function isPrivateSchool(settings) {
  const sector = String(settings?.schoolSector || "").trim();
  const type = String(settings?.schoolType || "").trim();
  if (sector === SCHOOL_SECTOR.PRIVATE) return true;
  if (sector === SCHOOL_SECTOR.PUBLIC) return false;
  return type === "Private";
}

export function isPublicSchool(settings) {
  return !isPrivateSchool(settings);
}

export function schoolSectorLabel(settings) {
  return isPrivateSchool(settings) ? SCHOOL_SECTOR.PRIVATE : SCHOOL_SECTOR.PUBLIC;
}

/** Government / public monthly fee defaults (existing Punjab SMS model). */
export function defaultPublicFeeSettings() {
  return {
    schoolSector: SCHOOL_SECTOR.PUBLIC,
    schoolType: "Government",
    feeAmount: PUBLIC_FEE_AMOUNT,
    feeStructure: {
      model: "public",
      defaultMonthlyTuition: PUBLIC_FEE_AMOUNT,
      admissionFee: 0,
      annualCharges: 0,
      annualChargesMonth: 4,
      securityDeposit: 0,
      labFeeMonthly: 0,
      examFeeAnnual: 0,
      classTuition: {},
    },
  };
}

/** Private-school fee defaults: tuition by class + admission / annual / deposits. */
export function defaultPrivateFeeSettings() {
  return {
    schoolSector: SCHOOL_SECTOR.PRIVATE,
    schoolType: "Private",
    feeAmount: PRIVATE_DEFAULT_MONTHLY,
    feeStructure: {
      model: "private",
      defaultMonthlyTuition: PRIVATE_DEFAULT_MONTHLY,
      admissionFee: 5000,
      annualCharges: 3000,
      annualChargesMonth: 4,
      securityDeposit: 2000,
      labFeeMonthly: 0,
      examFeeAnnual: 1500,
      classTuition: {},
    },
  };
}

export function ensureFeeStructure(settings) {
  const base = isPrivateSchool(settings) ? defaultPrivateFeeSettings() : defaultPublicFeeSettings();
  const fs = settings?.feeStructure && typeof settings.feeStructure === "object" ? settings.feeStructure : {};
  return {
    ...base.feeStructure,
    ...fs,
    classTuition:
      fs.classTuition && typeof fs.classTuition === "object" ? { ...fs.classTuition } : {},
  };
}

export function settingsForNewSchool({ schoolName, schoolEmail, principalName, sector }) {
  const isPrivate = String(sector) === SCHOOL_SECTOR.PRIVATE;
  const feeDefaults = isPrivate ? defaultPrivateFeeSettings() : defaultPublicFeeSettings();
  return {
    schoolName: String(schoolName || "").trim(),
    schoolEmail: String(schoolEmail || "").trim().toLowerCase(),
    principalName: String(principalName || "").trim(),
    ...feeDefaults,
  };
}

/**
 * Monthly amount due for one student (before concession).
 * Private: class tuition → defaultMonthlyTuition → feeAmount.
 * Public: flat feeAmount (default Rs 20).
 */
export function resolveMonthlyTuition(settings, student, classes = []) {
  const structure = ensureFeeStructure(settings);
  if (!isPrivateSchool(settings)) {
    const n = Number(settings?.feeAmount);
    if (Number.isFinite(n) && n >= 0) return n;
    return PUBLIC_FEE_AMOUNT;
  }

  const list = Array.isArray(classes) ? classes : [];
  const classId = student?.classId;
  const cls = list.find((c) => String(c.id) === String(classId)) || null;
  const map = structure.classTuition || {};
  const byId = cls?.id != null ? Number(map[String(cls.id)]) : NaN;
  if (Number.isFinite(byId) && byId >= 0) return byId;
  const label = String(cls?.label || cls?.name || "").trim();
  const byLabel = label ? Number(map[label]) : NaN;
  if (Number.isFinite(byLabel) && byLabel >= 0) return byLabel;

  const def = Number(structure.defaultMonthlyTuition ?? settings?.feeAmount);
  if (Number.isFinite(def) && def >= 0) return def;
  return PRIVATE_DEFAULT_MONTHLY;
}

export function resolveAdmissionFee(settings) {
  if (!isPrivateSchool(settings)) return 0;
  const n = Number(ensureFeeStructure(settings).admissionFee);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function resolveAnnualCharges(settings) {
  if (!isPrivateSchool(settings)) return 0;
  const n = Number(ensureFeeStructure(settings).annualCharges);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Switch an existing school between Public and Private, seeding fee defaults
 * while preserving classTuition / custom amounts when staying in the same model.
 */
export function applySchoolSector(settings, sector) {
  const prev = settings && typeof settings === "object" ? settings : {};
  const nextSector =
    String(sector) === SCHOOL_SECTOR.PRIVATE ? SCHOOL_SECTOR.PRIVATE : SCHOOL_SECTOR.PUBLIC;
  const wasPrivate = isPrivateSchool(prev);

  if (nextSector === SCHOOL_SECTOR.PRIVATE) {
    const priv = defaultPrivateFeeSettings();
    const keepTuition = wasPrivate ? ensureFeeStructure(prev).classTuition : {};
    const feeAmount =
      wasPrivate && Number(prev.feeAmount) > 0
        ? Number(prev.feeAmount)
        : priv.feeAmount;
    return {
      ...prev,
      schoolSector: SCHOOL_SECTOR.PRIVATE,
      schoolType: prev.schoolType === "Private" ? prev.schoolType : "Private",
      feeAmount,
      feeStructure: {
        ...priv.feeStructure,
        ...(wasPrivate ? ensureFeeStructure(prev) : {}),
        model: "private",
        defaultMonthlyTuition:
          Number(wasPrivate ? ensureFeeStructure(prev).defaultMonthlyTuition : feeAmount) ||
          priv.feeStructure.defaultMonthlyTuition,
        classTuition: { ...keepTuition },
      },
    };
  }

  const pub = defaultPublicFeeSettings();
  const feeAmount =
    !wasPrivate && Number(prev.feeAmount) >= 0 && Number(prev.feeAmount) <= 500
      ? Number(prev.feeAmount)
      : PUBLIC_FEE_AMOUNT;
  return {
    ...prev,
    schoolSector: SCHOOL_SECTOR.PUBLIC,
    schoolType:
      prev.schoolType && prev.schoolType !== "Private" ? prev.schoolType : "Government",
    feeAmount,
    feeStructure: {
      ...pub.feeStructure,
      defaultMonthlyTuition: feeAmount,
      classTuition: {},
    },
  };
}
