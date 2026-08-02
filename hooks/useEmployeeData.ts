import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "./useAuth";
import { LeaveBalance, LeaveRequest, SalaryAdvance, MonthlyScore, AttendanceRecord, Shift } from "@/types";

export function useEmployeeData() {
  const { employee } = useAuthStore();
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [monthlyScore, setMonthlyScore] = useState<MonthlyScore | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [todayShift, setTodayShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!employee) return;
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const month = new Date().toLocaleString("en", { month: "long" });
    const year = new Date().getFullYear();

    const [lb, lr, ad, ms, att, sh] = await Promise.all([
      supabase.from("leave_balances").select("*").eq("employee_id", employee.id).single(),
      supabase.from("leave_requests").select("*").eq("employee_id", employee.id).order("applied_on", { ascending: false }),
      supabase.from("salary_advances").select("*").eq("employee_id", employee.id).order("applied_on", { ascending: false }),
      supabase.from("monthly_scores").select("*").eq("employee_id", employee.id).eq("month", month).eq("year", year).single(),
      supabase.from("attendance_records").select("*").eq("employee_id", employee.id).gte("date", `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`),
      supabase.from("shifts").select("*").eq("department_id", employee.department_id).single(),
    ]);

    if (lb.data) setLeaveBalance(lb.data as LeaveBalance);
    if (lr.data) setLeaveRequests(lr.data as LeaveRequest[]);
    if (ad.data) setAdvances(ad.data as SalaryAdvance[]);
    if (ms.data) setMonthlyScore(ms.data as MonthlyScore);
    if (att.data) setAttendance(att.data as AttendanceRecord[]);
    if (sh.data) setTodayShift(sh.data as Shift);
    setLoading(false);
  }, [employee]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { leaveBalance, leaveRequests, advances, monthlyScore, attendance, todayShift, loading, refresh: fetchAll };
}