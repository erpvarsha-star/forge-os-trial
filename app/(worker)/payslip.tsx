import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useAuthStore } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { PayrollRecord } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { APP_CONFIG } from "@/lib/config";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Download, ChevronDown } from "lucide-react-native";

export default function PayslipScreen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [selected, setSelected] = useState<PayrollRecord | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    fetchPayslips();
  }, []);

  const fetchPayslips = async () => {
    if (!employee) return;
    const { data } = await supabase.from("payroll_records").select("*").eq("employee_id", employee.id).order("year", { ascending: false });
    if (data) { setRecords(data as PayrollRecord[]); if (data.length > 0) setSelected(data[0] as PayrollRecord); }
  };

  const downloadPdf = async () => {
    if (!selected || !employee) return;
    const html = `
      <html><body style="font-family: Arial; padding: 20px;">
        <h2 style="text-align: center; color: #E65C00;">${APP_CONFIG.companyName}</h2>
        <h3 style="text-align: center;">${t("payslip.title")}</h3>
        <hr/>
        <p><strong>${t("payslip.month")}:</strong> ${selected.month} ${selected.year}</p>
        <p><strong>Name:</strong> ${employee.name}</p>
        <p><strong>${t("home.empCode")}:</strong> ${employee.emp_code}</p>
        <hr/>
        <h4>${t("payslip.earnings")}</h4>
        <table width="100%"><tr><td>${t("payslip.basic")}</td><td align="right">${formatCurrency(selected.basic)}</td></tr>
        <tr><td>${t("payslip.hra")}</td><td align="right">${formatCurrency(selected.hra)}</td></tr>
        <tr><td>${t("payslip.conveyance")}</td><td align="right">${formatCurrency(selected.conveyance)}</td></tr>
        <tr><td>${t("payslip.special")}</td><td align="right">${formatCurrency(selected.special_allowance)}</td></tr>
        <tr><td>${t("payslip.ot")}</td><td align="right">${formatCurrency(selected.ot_amount)}</td></tr>
        ${selected.production_incentive ? `<tr><td>${t("payslip.productionIncentive")}</td><td align="right">${formatCurrency(selected.production_incentive)}</td></tr>` : ""}
        <tr style="font-weight: bold;"><td>${t("payslip.grossEarnings")}</td><td align="right">${formatCurrency(selected.gross_earnings)}</td></tr>
        </table>
        <h4>${t("payslip.deductions")}</h4>
        <table width="100%"><tr><td>${t("payslip.pf")}</td><td align="right">${formatCurrency(selected.pf_deduction)}</td></tr>
        <tr><td>${t("payslip.esic")}</td><td align="right">${formatCurrency(selected.esic_deduction)}</td></tr>
        <tr><td>${t("payslip.pt")}</td><td align="right">${formatCurrency(selected.pt_deduction)}</td></tr>
        <tr><td>${t("payslip.advanceRecovery")}</td><td align="right">${formatCurrency(selected.advance_recovery)}</td></tr>
        <tr><td>${t("payslip.tds")}</td><td align="right">${formatCurrency(selected.tds)}</td></tr>
        <tr style="font-weight: bold;"><td>${t("payslip.totalDeductions")}</td><td align="right">${formatCurrency(selected.total_deductions)}</td></tr>
        </table>
        <hr/>
        <h2 style="text-align: center; color: #E65C00;">${t("payslip.netPay")}: ${formatCurrency(selected.net_pay)}</h2>
        <p style="text-align: center;">${t("payslip.paidDays")}: ${selected.paid_days}</p>
      </body></html>
    `;
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
  };

  if (!selected) return <SafeView><Text className="text-center mt-10">No payslips found</Text></SafeView>;

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("payslip.title")}</Text>

        {/* Month Selector */}
        <TouchableOpacity onPress={() => setShowPicker(!showPicker)} className="bg-white border border-gray-300 rounded-lg p-3 flex-row justify-between items-center mb-4">
          <Text className="text-gray-800">{selected.month} {selected.year}</Text>
          <ChevronDown size={18} color="#6B7280" />
        </TouchableOpacity>

        {showPicker && (
          <View className="bg-white border border-gray-200 rounded-lg mb-4 max-h-40">
            {records.map((r) => (
              <TouchableOpacity key={r.id} onPress={() => { setSelected(r); setShowPicker(false); }} className="p-3 border-b border-gray-100">
                <Text className="text-gray-800">{r.month} {r.year}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Payslip Content */}
        <Card>
          <Text className="text-center text-primary font-bold text-lg mb-1">{APP_CONFIG.companyName}</Text>
          <Text className="text-center text-gray-500 text-sm mb-4">{t("payslip.title")}</Text>

          <View className="border-t border-gray-200 pt-4 mb-4">
            <Text className="font-bold text-gray-800 mb-2">{t("payslip.employeeDetails")}</Text>
            <Text className="text-gray-600">{employee?.name} ({employee?.emp_code})</Text>
            <Text className="text-gray-600">{employee?.department}</Text>
          </View>

          <Text className="font-bold text-gray-800 mb-2">{t("payslip.earnings")}</Text>
          <View className="mb-4">
            {[
              { label: t("payslip.basic"), value: selected.basic },
              { label: t("payslip.hra"), value: selected.hra },
              { label: t("payslip.conveyance"), value: selected.conveyance },
              { label: t("payslip.special"), value: selected.special_allowance },
              { label: t("payslip.ot"), value: selected.ot_amount },
              ...(selected.production_incentive ? [{ label: t("payslip.productionIncentive"), value: selected.production_incentive }] : []),
            ].map((item) => (
              <View key={item.label} className="flex-row justify-between py-1">
                <Text className="text-gray-600">{item.label}</Text>
                <Text className="text-gray-800">{formatCurrency(item.value)}</Text>
              </View>
            ))}
            <View className="flex-row justify-between pt-2 border-t border-gray-200 mt-2">
              <Text className="font-bold text-gray-800">{t("payslip.grossEarnings")}</Text>
              <Text className="font-bold text-primary">{formatCurrency(selected.gross_earnings)}</Text>
            </View>
          </View>

          <Text className="font-bold text-gray-800 mb-2">{t("payslip.deductions")}</Text>
          <View className="mb-4">
            {[
              { label: t("payslip.pf"), value: selected.pf_deduction },
              { label: t("payslip.esic"), value: selected.esic_deduction },
              { label: t("payslip.pt"), value: selected.pt_deduction },
              { label: t("payslip.advanceRecovery"), value: selected.advance_recovery },
              { label: t("payslip.tds"), value: selected.tds },
            ].map((item) => (
              <View key={item.label} className="flex-row justify-between py-1">
                <Text className="text-gray-600">{item.label}</Text>
                <Text className="text-gray-800">{formatCurrency(item.value)}</Text>
              </View>
            ))}
            <View className="flex-row justify-between pt-2 border-t border-gray-200 mt-2">
              <Text className="font-bold text-gray-800">{t("payslip.totalDeductions")}</Text>
              <Text className="font-bold text-danger">{formatCurrency(selected.total_deductions)}</Text>
            </View>
          </View>

          <View className="bg-primary/5 rounded-lg p-4 items-center">
            <Text className="text-gray-600 text-sm">{t("payslip.netPay")}</Text>
            <Text className="text-3xl font-bold text-primary">{formatCurrency(selected.net_pay)}</Text>
            <Text className="text-gray-500 text-xs mt-1">{t("payslip.paidDays")}: {selected.paid_days}</Text>
          </View>
        </Card>

        <Button title={t("payslip.downloadPdf")} onPress={downloadPdf} className="mt-4" icon={<Download size={18} color="white" />} />
      </ScrollView>
    </SafeView>
  );
}