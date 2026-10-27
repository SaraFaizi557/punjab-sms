import React, { useEffect, useMemo, useState } from "react";
import { consumeNavIntent } from "@/lib/navIntent.js";
import { FeePage } from "./FeePage";
import {
  FeeOverviewPanel,
  FeeDuesPanel,
  FeeReceiptsPanel,
  FeeConcessionsPanel,
  FeeExpensesPanel,
  FeeReportsPanel,
} from "./FeeFinancePanels.jsx";
import { FeeStructurePanel } from "./FeeStructurePanel.jsx";
import {
  feeTabsForSchool,
  getEffectiveFeeAmount,
  formatCurrency,
} from "./feeFinanceCore.js";
import { ModulePageShell } from "@/components/ModulePageShell";
import { isPrivateSchool, schoolSectorLabel } from "@/shared/schoolCategory.js";

function initialFeeTab(settings) {
  const tabs = feeTabsForSchool(settings);
  const allowed = new Set(tabs.map((t) => t.id));
  const intent = consumeNavIntent();
  if (!intent || (intent.page && intent.page !== "fees")) return "overview";
  const alias = intent.tab === "summary" || intent.tab === "class-detail" ? "collection" : intent.tab;
  if (alias && allowed.has(alias)) return alias;
  return "overview";
}

export function FeeFinanceModulePage({
  settings,
  setSettings,
  students,
  activeSchoolId,
  setBarSubtitle,
}) {
  const privateSchool = isPrivateSchool(settings);
  const tabs = useMemo(() => feeTabsForSchool(settings), [settings]);
  const [tab, setTab] = useState(() => initialFeeTab(settings));
  const feeAmount = getEffectiveFeeAmount(settings);

  useEffect(() => {
    const allowed = new Set(tabs.map((t) => t.id));
    if (!allowed.has(tab)) setTab("overview");
  }, [tabs, tab]);

  useEffect(() => {
    if (!setBarSubtitle) return;
    const t = tabs.find((x) => x.id === tab);
    const sector = schoolSectorLabel(settings);
    setBarSubtitle(
      privateSchool
        ? `${sector} · ${t?.l || "Fees"}`
        : `${sector} · ${formatCurrency(feeAmount)}/month`,
    );
    return () => setBarSubtitle?.("");
  }, [tab, setBarSubtitle, feeAmount, privateSchool, settings, tabs]);

  const description = privateSchool
    ? `Private school · Class-wise tuition, admission & annual charges · ${formatCurrency(feeAmount)} default / month`
    : `Public / government · Flat monthly fee ${formatCurrency(feeAmount)} · Collection, dues, receipts & expenses`;

  return (
    <ModulePageShell
      title="Fee & Financial Management"
      description={description}
      tabs={tabs}
      tab={tab}
      onTabChange={setTab}
    >
      {tab === "overview" && (
        <FeeOverviewPanel
          settings={settings}
          students={students}
          activeSchoolId={activeSchoolId}
          onGoTab={setTab}
        />
      )}

      {tab === "collection" && (
        <FeePage
          settings={settings}
          students={students}
          activeSchoolId={activeSchoolId}
          setBarSubtitle={null}
        />
      )}

      {tab === "structure" && (
        <FeeStructurePanel settings={settings} setSettings={setSettings} />
      )}

      {tab === "dues" && (
        <FeeDuesPanel settings={settings} students={students} activeSchoolId={activeSchoolId} />
      )}

      {tab === "receipts" && (
        <FeeReceiptsPanel settings={settings} students={students} activeSchoolId={activeSchoolId} />
      )}

      {tab === "concessions" && (
        <FeeConcessionsPanel
          settings={settings}
          students={students}
          setSettings={setSettings}
          activeSchoolId={activeSchoolId}
        />
      )}

      {tab === "expenses" && <FeeExpensesPanel activeSchoolId={activeSchoolId} />}

      {tab === "reports" && (
        <FeeReportsPanel settings={settings} students={students} activeSchoolId={activeSchoolId} />
      )}
    </ModulePageShell>
  );
}
