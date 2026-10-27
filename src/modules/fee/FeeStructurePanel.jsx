import React, { useMemo } from "react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatClassDisplay } from "@/modules/systemSettings/systemSettingsCore";
import { formatCurrency } from "./feeFinanceCore.js";
import {
  ensureFeeStructure,
  isPrivateSchool,
  defaultPrivateFeeSettings,
} from "@/shared/schoolCategory.js";

/**
 * Private-school fee plan: class tuition, admission, annual charges, deposits.
 */
export function FeeStructurePanel({ settings, setSettings }) {
  const structure = useMemo(() => ensureFeeStructure(settings), [settings]);
  const classes = Array.isArray(settings?.classes) ? settings.classes : [];

  if (!isPrivateSchool(settings)) {
    return (
      <Card className="shadow-none">
        <CardContent className="p-4">
          <CardTitle className="mb-1">Public / government fee model</CardTitle>
          <CardDescription>
            This school uses the flat monthly fee (default Rs 20). Switch school sector to Private in
            Settings to enable class-wise tuition, admission fee, and annual charges.
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  const patchStructure = (patch) => {
    setSettings?.((s) => {
      const nextFs = { ...ensureFeeStructure(s), ...patch };
      const defaultMonthly = Number(nextFs.defaultMonthlyTuition);
      return {
        ...s,
        feeAmount: Number.isFinite(defaultMonthly) ? defaultMonthly : s.feeAmount,
        feeStructure: nextFs,
        schoolSector: "Private",
        schoolType: s.schoolType === "Private" ? s.schoolType : "Private",
      };
    });
  };

  const setClassTuition = (classId, value) => {
    const n = value === "" ? "" : Number(value);
    setSettings?.((s) => {
      const fs = ensureFeeStructure(s);
      const classTuition = { ...(fs.classTuition || {}) };
      if (value === "" || !Number.isFinite(n)) delete classTuition[String(classId)];
      else classTuition[String(classId)] = Math.max(0, n);
      return { ...s, feeStructure: { ...fs, classTuition } };
    });
  };

  const seedDefaults = () => {
    const d = defaultPrivateFeeSettings();
    setSettings?.((s) => ({
      ...s,
      ...d,
      feeStructure: {
        ...d.feeStructure,
        classTuition: { ...(ensureFeeStructure(s).classTuition || {}) },
      },
    }));
  };

  return (
    <div className="flex flex-col gap-3.5">
      <Card className="shadow-none border-primary/20">
        <CardContent className="p-4">
          <CardTitle className="mb-1">Private school fee structure</CardTitle>
          <CardDescription className="mb-3">
            Standard private billing: monthly tuition (by class), one-time admission, annual charges,
            security deposit, and optional lab / exam fees. Collection uses each student&apos;s class
            tuition.
          </CardDescription>
          <button
            type="button"
            className="text-xs font-medium text-primary underline-offset-2 hover:underline mb-3"
            onClick={seedDefaults}
          >
            Reset to private defaults
          </button>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Default monthly tuition (Rs)</Label>
              <Input
                type="number"
                min={0}
                value={structure.defaultMonthlyTuition ?? ""}
                onChange={(e) =>
                  patchStructure({
                    defaultMonthlyTuition:
                      e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
              <p className="text-[11px] text-muted-foreground">Used when a class has no override.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Admission fee (Rs)</Label>
              <Input
                type="number"
                min={0}
                value={structure.admissionFee ?? ""}
                onChange={(e) =>
                  patchStructure({
                    admissionFee: e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Security deposit (Rs)</Label>
              <Input
                type="number"
                min={0}
                value={structure.securityDeposit ?? ""}
                onChange={(e) =>
                  patchStructure({
                    securityDeposit:
                      e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Annual charges (Rs)</Label>
              <Input
                type="number"
                min={0}
                value={structure.annualCharges ?? ""}
                onChange={(e) =>
                  patchStructure({
                    annualCharges:
                      e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Annual charges month</Label>
              <NativeSelect
                value={String(structure.annualChargesMonth || 4)}
                onChange={(e) => patchStructure({ annualChargesMonth: Number(e.target.value) || 4 })}
                className="w-full"
              >
                {[
                  [1, "January"],
                  [2, "February"],
                  [3, "March"],
                  [4, "April"],
                  [5, "May"],
                  [6, "June"],
                  [7, "July"],
                  [8, "August"],
                  [9, "September"],
                  [10, "October"],
                  [11, "November"],
                  [12, "December"],
                ].map(([v, l]) => (
                  <NativeSelectOption key={v} value={String(v)}>
                    {l}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label>Lab fee / month (Rs)</Label>
              <Input
                type="number"
                min={0}
                value={structure.labFeeMonthly ?? ""}
                onChange={(e) =>
                  patchStructure({
                    labFeeMonthly:
                      e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Exam fee / year (Rs)</Label>
              <Input
                type="number"
                min={0}
                value={structure.examFeeAnnual ?? ""}
                onChange={(e) =>
                  patchStructure({
                    examFeeAnnual:
                      e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardContent className="p-4">
          <CardTitle className="mb-1">Tuition by class</CardTitle>
          <CardDescription className="mb-3">
            Override monthly tuition per class. Empty = use default (
            {formatCurrency(structure.defaultMonthlyTuition)}).
          </CardDescription>
          {classes.length === 0 ? (
            <p className="text-sm text-muted-foreground m-0">
              Add classes in Academic / Settings first, then set tuition here.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {classes.map((cls) => {
                const id = String(cls.id);
                const val = structure.classTuition?.[id];
                return (
                  <div key={id} className="flex items-end gap-2 rounded-lg border border-border px-3 py-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label className="truncate">{formatClassDisplay(cls) || cls.label || id}</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder={String(structure.defaultMonthlyTuition ?? "")}
                        value={val == null || val === "" ? "" : val}
                        onChange={(e) => setClassTuition(id, e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
