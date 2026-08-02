import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

export default function HRAdminHome() {
  const { t } = useTranslation();

  const menuItems = [
    { title: t("hrAdmin.employeeMaster"), route: "/(hr-admin)/employees" },
    { title: t("hrAdmin.shiftPlanning"), route: "/(hr-admin)/shifts" },
    { title: t("hrAdmin.missingData"), route: "/(hr-admin)/missing-data" },
    { title: t("hrAdmin.payrollSummary"), route: "/(hr-admin)/payroll" },
    { title: t("hrAdmin.generatePayslip"), route: "/(hr-admin)/payslip-generator" },
    { title: t("hrAdmin.pfChallan"), route: "/(hr-admin)/pf-export" },
    { title: t("hrAdmin.esicChallan"), route: "/(hr-admin)/esic-export" },
    { title: t("hrAdmin.leaveBalance"), route: "/(hr-admin)/leave-balances" },
    { title: t("hrAdmin.advanceLedger"), route: "/(hr-admin)/advance-ledger" },
    { title: t("hrAdmin.newEmployee"), route: "/(hr-admin)/new-employee" },
  ];

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">HR Admin</Text>
        {menuItems.map((item) => (
          <Card key={item.title} className="mb-2">
            <Button title={item.title} onPress={() => router.push(item.route as any)} variant="outline" />
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}