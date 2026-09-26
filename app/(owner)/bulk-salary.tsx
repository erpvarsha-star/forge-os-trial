import React, { useState } from 'react'
import { View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { parseCsv, toCsv } from '@/lib/csv'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { Download, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react-native'
import { STATUS, INK, BRAND } from '@/components/theme'

const REQUIRED_FIELDS = ['ctc_annual', 'basic', 'hra', 'conveyance'] as const
const OPTIONAL_FIELDS = [
  'washing', 'education', 'heat_allow', 'vda', 'production_allow',
  'medical', 'professional_development', 'communication', 'uniform',
] as const
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]

interface ParsedRow {
  emp_code: string
  [key: string]: string | number | null
}

interface BulkResultRow {
  emp_code: string
  name?: string
  status: 'update' | 'updated' | 'unchanged' | 'not_found'
}

export default function BulkSalaryScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()

  const [isDownloading, setIsDownloading] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null)
  const [preview, setPreview] = useState<{ summary: Record<string, number>; results: BulkResultRow[] } | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<{ summary: Record<string, number>; results: BulkResultRow[] } | null>(null)

  if (!employee) return <LoadingScreen />

  const reset = () => {
    setFileError(null)
    setParsedRows(null)
    setPreview(null)
    setApplyResult(null)
  }

  const handleDownloadCurrent = async () => {
    setIsDownloading(true)
    const { data, error } = await supabase
      .from('employee_salary_structure')
      .select('*, employee:employees!inner(emp_code, name, department, is_active)')
      .eq('is_active', true)
      .eq('employee.is_active', true)

    setIsDownloading(false)
    if (error || !data) {
      Alert.alert(t('common.error'), t('common.somethingWentWrong'))
      return
    }

    const sorted = [...data].sort((a: any, b: any) => a.employee.emp_code.localeCompare(b.employee.emp_code))

    const headers = ['emp_code', 'name', 'department', ...ALL_FIELDS]
    const rows = sorted.map((r: any) => [
      r.employee.emp_code,
      r.employee.name,
      r.employee.department,
      ...ALL_FIELDS.map(f => r[f] ?? ''),
    ])
    const csv = toCsv(headers, rows)
    const uri = FileSystem.documentDirectory + `salary_current_${Date.now()}.csv`
    await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 })
    await Sharing.shareAsync(uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' })
  }

  const handlePickFile = async () => {
    reset()
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel', '*/*'],
      copyToCacheDirectory: true,
    })
    if (result.canceled || !result.assets?.[0]) return

    setIsParsing(true)
    try {
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 })
      const table = parseCsv(content)
      if (table.length < 2) throw new Error(t('hrAdmin.bulkCsvEmpty'))

      const header = table[0].map(h => h.trim().toLowerCase())
      const missing = ['emp_code', ...REQUIRED_FIELDS].filter(f => !header.includes(f))
      if (missing.length > 0) {
        setFileError(t('hrAdmin.bulkMissingColumns', { columns: missing.join(', ') }))
        setIsParsing(false)
        return
      }

      const colIndex: Record<string, number> = {}
      header.forEach((h, i) => { colIndex[h] = i })

      const seen = new Set<string>()
      const duplicates = new Set<string>()
      const rowErrors: string[] = []
      const rows: ParsedRow[] = []

      for (let i = 1; i < table.length; i++) {
        const raw = table[i]
        if (raw.every(c => c.trim() === '')) continue // blank trailing line

        const empCode = (raw[colIndex['emp_code']] || '').trim().toUpperCase()
        if (!empCode) { rowErrors.push(t('hrAdmin.bulkRowMissingCode', { row: i + 1 })); continue }
        if (seen.has(empCode)) duplicates.add(empCode)
        seen.add(empCode)

        const row: ParsedRow = { emp_code: empCode }
        let rowHasError = false

        for (const field of ALL_FIELDS) {
          const idx = colIndex[field]
          const cell = idx === undefined ? '' : (raw[idx] || '').trim()
          if (cell === '') {
            row[field] = REQUIRED_FIELDS.includes(field as any) ? null : null
            if (REQUIRED_FIELDS.includes(field as any)) {
              rowErrors.push(t('hrAdmin.bulkRowMissingField', { row: i + 1, code: empCode, field }))
              rowHasError = true
            }
          } else {
            const num = Number(cell)
            if (Number.isNaN(num) || num < 0) {
              rowErrors.push(t('hrAdmin.bulkRowBadNumber', { row: i + 1, code: empCode, field, value: cell }))
              rowHasError = true
            } else {
              row[field] = num
            }
          }
        }

        if (!rowHasError) rows.push(row)
      }

      if (duplicates.size > 0) {
        setFileError(t('hrAdmin.bulkDuplicateCodes', { codes: Array.from(duplicates).join(', ') }))
        setIsParsing(false)
        return
      }
      if (rowErrors.length > 0) {
        setFileError(rowErrors.slice(0, 8).join('\n') + (rowErrors.length > 8 ? `\n… +${rowErrors.length - 8} more` : ''))
        setIsParsing(false)
        return
      }
      if (rows.length === 0) {
        setFileError(t('hrAdmin.bulkCsvEmpty'))
        setIsParsing(false)
        return
      }

      setParsedRows(rows)

      const { data, error } = await supabase.rpc('bulk_apply_salary_changes', { p_rows: rows, p_dry_run: true })
      setIsParsing(false)
      if (error) {
        setFileError(t('common.somethingWentWrong'))
        return
      }
      setPreview(data as any)
    } catch (e: any) {
      setIsParsing(false)
      setFileError(e?.message || t('common.somethingWentWrong'))
    }
  }

  const handleApply = async () => {
    if (!parsedRows || isApplying) return
    setIsApplying(true)
    const { data, error } = await supabase.rpc('bulk_apply_salary_changes', { p_rows: parsedRows, p_dry_run: false })
    setIsApplying(false)
    if (error) {
      Alert.alert(t('common.error'), t('common.somethingWentWrong'))
      return
    }
    setApplyResult(data as any)
    setPreview(null)
  }

  const renderResultList = (results: BulkResultRow[], status: string) => {
    const filtered = results.filter(r => r.status === status)
    if (filtered.length === 0) return null
    return (
      <View className="mt-2">
        {filtered.map((r, i) => (
          <Text key={i} className="text-xs text-ink-600 font-mono">
            {r.emp_code}{r.name ? ` — ${r.name}` : ''}
          </Text>
        ))}
      </View>
    )
  }

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-ink-900 tracking-tight mb-1">{t('hrAdmin.bulkSalaryTitle')}</Text>
        <Text className="text-sm text-ink-500 mb-5">{t('hrAdmin.bulkSalaryHint')}</Text>

        <Card className="mb-4">
          <TouchableOpacity onPress={handleDownloadCurrent} disabled={isDownloading} className="flex-row items-center gap-3 min-h-touch">
            <View className="w-10 h-10 rounded-full bg-brand-50 items-center justify-center">
              {isDownloading ? <ActivityIndicator size="small" color={BRAND[600]} /> : <Download size={18} color={BRAND[600]} />}
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-ink-900">{t('hrAdmin.bulkDownloadCurrent')}</Text>
              <Text className="text-xs text-ink-500">{t('hrAdmin.bulkDownloadCurrentHint')}</Text>
            </View>
          </TouchableOpacity>
        </Card>

        <Card className="mb-4">
          <TouchableOpacity onPress={handlePickFile} disabled={isParsing} className="flex-row items-center gap-3 min-h-touch">
            <View className="w-10 h-10 rounded-full bg-brand-50 items-center justify-center">
              {isParsing ? <ActivityIndicator size="small" color={BRAND[600]} /> : <Upload size={18} color={BRAND[600]} />}
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-ink-900">{t('hrAdmin.bulkUploadRevised')}</Text>
              <Text className="text-xs text-ink-500">{t('hrAdmin.bulkUploadRevisedHint')}</Text>
            </View>
          </TouchableOpacity>
        </Card>

        {fileError && (
          <Card className="mb-4 bg-status-rejected-bg" variant="flat">
            <View className="flex-row items-start gap-2">
              <AlertTriangle size={16} color={STATUS.rejected.fg} style={{ marginTop: 1 }} />
              <Text className="text-xs text-status-rejected flex-1">{fileError}</Text>
            </View>
          </Card>
        )}

        {preview && (
          <>
            <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">
              {t('hrAdmin.bulkPreviewTitle')}
            </Text>
            <Card className="mb-4">
              <View className="flex-row gap-2 mb-1">
                <View className="flex-1 items-center py-2 bg-status-pending-bg rounded-lg">
                  <Text className="text-lg font-bold text-status-pending tabular-nums">{preview.summary.update ?? 0}</Text>
                  <Text className="text-2xs text-ink-500">{t('hrAdmin.bulkToUpdate')}</Text>
                </View>
                <View className="flex-1 items-center py-2 bg-ink-100 rounded-lg">
                  <Text className="text-lg font-bold text-ink-600 tabular-nums">{preview.summary.unchanged ?? 0}</Text>
                  <Text className="text-2xs text-ink-500">{t('hrAdmin.bulkUnchanged')}</Text>
                </View>
                <View className="flex-1 items-center py-2 bg-status-rejected-bg rounded-lg">
                  <Text className="text-lg font-bold text-status-rejected tabular-nums">{preview.summary.not_found ?? 0}</Text>
                  <Text className="text-2xs text-ink-500">{t('hrAdmin.bulkNotFound')}</Text>
                </View>
              </View>
              {renderResultList(preview.results, 'update')}
              {(preview.summary.not_found ?? 0) > 0 && (
                <View className="mt-2">
                  <Text className="text-xs font-semibold text-status-rejected mb-1">{t('hrAdmin.bulkNotFound')}:</Text>
                  {renderResultList(preview.results, 'not_found')}
                </View>
              )}
            </Card>

            {(preview.summary.update ?? 0) > 0 ? (
              <Button
                title="hrAdmin.bulkApplyAction"
                onPress={handleApply}
                loading={isApplying}
                size="lg"
              />
            ) : (
              <Card className="items-center py-6" variant="flat">
                <Text className="text-sm text-ink-500">{t('hrAdmin.bulkNothingToApply')}</Text>
              </Card>
            )}
          </>
        )}

        {applyResult && (
          <Card className="items-center py-8">
            <CheckCircle2 size={32} color={STATUS.approved.fg} />
            <Text className="text-base font-bold text-ink-900 mt-3">{t('hrAdmin.bulkApplied')}</Text>
            <Text className="text-sm text-ink-500 mt-1 text-center">
              {t('hrAdmin.bulkAppliedBody', { updated: applyResult.summary.update ?? 0 })}
            </Text>
          </Card>
        )}
      </ScrollView>
    </View>
  )
}
