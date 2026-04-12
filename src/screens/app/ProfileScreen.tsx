import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { differenceInCalendarDays, format } from 'date-fns';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { calculateGoalTargets, fetchLatestMetrics, saveNutritionGoalTargets, saveUserMetric } from '@/services/nutrition';
import { getSummary } from '@/services/summary';
import { getCurrentUser } from '@/services/users';
import { colors } from '@/theme/tokens';
import type { GoalCalculationParams, GoalCalculationResult, MetricData } from '@/types/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'heavy' | 'athlete';
type GoalType = 'cutting' | 'lean_bulk' | 'maintain' | 'recomposition';
type GoalSpeed = 'slow' | 'moderate' | 'aggressive';

function getCurrentMonth() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

function formatVolume(value?: number) {
  if (!value || value <= 0) return '0';
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value));
}

function sanitizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return `${cleaned.slice(0, firstDot + 1)}${cleaned.slice(firstDot + 1).replace(/\./g, '')}`;
}

function PersonalRecordChart({
  data,
}: {
  data: Array<{ date: string; weight: number }>;
}) {
  const width = Math.max(Dimensions.get('window').width - 84, data.length * 56);
  const height = 280;
  const padding = { top: 26, right: 18, bottom: 44, left: 34 };
  const drawW = width - padding.left - padding.right;
  const drawH = height - padding.top - padding.bottom;
  const maxY = Math.max(1, ...data.map((d) => d.weight));
  const stepX = data.length > 1 ? drawW / (data.length - 1) : drawW;

  return (
    <Svg width={width} height={height}>
      {[0, 0.5, 1].map((tick) => {
        const value = Math.round(maxY * tick);
        const y = padding.top + (1 - tick) * drawH;
        return (
          <G key={`grid-${tick}`}>
            <Line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 4"
            />
            <SvgText x={2} y={y + 4} fill={colors.textDim} fontSize="9">
              {value}
            </SvgText>
          </G>
        );
      })}

      {data.map((point, idx) => {
        if (idx === data.length - 1) return null;
        const currentX = padding.left + idx * stepX;
        const nextX = padding.left + (idx + 1) * stepX;
        const currentY = padding.top + drawH - (Math.max(0, point.weight) / maxY) * drawH;
        const nextY = padding.top + drawH - (Math.max(0, data[idx + 1].weight) / maxY) * drawH;
        return (
          <Line
            key={`segment-${point.date}-${idx}`}
            x1={currentX}
            y1={currentY}
            x2={nextX}
            y2={nextY}
            stroke={colors.primary}
            strokeWidth={3}
            strokeLinecap="round"
          />
        );
      })}

      {data.map((point, idx) => {
        const x = padding.left + idx * stepX;
        const y = padding.top + drawH - (Math.max(0, point.weight) / maxY) * drawH;
        return (
          <G key={`point-group-${point.date}-${idx}`}>
            <SvgText
              x={x}
              y={Math.max(12, y - 10)}
              fill={colors.textPrimary}
              fontSize="10"
              fontWeight="700"
              textAnchor="middle"
            >
              {Math.round(point.weight)}
            </SvgText>
            <Circle
              cx={x}
              cy={y}
              r={5}
              fill={colors.primary}
            />
            <Rect
              x={x - 0.5}
              y={padding.top + drawH}
              width={1}
              height={6}
              fill="rgba(255,255,255,0.18)"
            />
            <SvgText
              x={x}
              y={height - 14}
              fill={colors.textDim}
              fontSize="9"
              textAnchor="middle"
            >
              {format(new Date(point.date), 'dd/MM/yy')}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ─── UpdateSpecsModal ─────────────────────────────────────────────────────────

const ACTIVITY_OPTIONS: { id: ActivityLevel; label: string; desc: string }[] = [
  { id: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise' },
  { id: 'light',     label: 'Light',     desc: '1–3 days/week' },
  { id: 'moderate',  label: 'Moderate',  desc: '3–5 days/week' },
  { id: 'heavy',     label: 'Heavy',     desc: '6–7 days/week' },
  { id: 'athlete',   label: 'Athlete',   desc: 'Intense training / Physical job' },
];

function UpdateSpecsModal({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weightDraft, setWeightDraft] = useState('75');
  const [form, setForm] = useState<Partial<MetricData>>({
    age: 25,
    sex: 'male',
    height_cm: 175,
    weight_kg: 75,
    activity_level: 'moderate',
  });

  const loadMetrics = useCallback(async () => {
    const latest = await fetchLatestMetrics();
    if (latest) {
      setForm((prev) => ({ ...prev, ...latest }));
      setWeightDraft(latest.weight_kg != null ? String(latest.weight_kg) : '');
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setStep(0);
      setError(null);
      setWeightDraft(form.weight_kg != null ? String(form.weight_kg) : '');
      void loadMetrics();
    }
  }, [visible, loadMetrics]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await saveUserMetric(form);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save specs');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <View style={modal.header}>
            <View>
              <Text style={modal.kicker}>Biological Specs</Text>
              <View style={modal.stepDotsRow}>
                {[0, 1].map((i) => (
                  <View key={i} style={[modal.stepDot, i <= step && modal.stepDotActive]} />
                ))}
              </View>
            </View>
            <Pressable onPress={onClose} style={modal.closeBtn}>
              <MaterialCommunityIcons color={colors.textDim} name="close" size={20} />
            </Pressable>
          </View>

          <Text style={modal.stepTitle}>{step === 0 ? 'Your body' : 'Lifestyle'}</Text>

          <ScrollView style={modal.scroll} contentContainerStyle={modal.scrollContent}>
            {step === 0 ? (
              <>
                <Text style={modal.fieldLabel}>Biological Sex</Text>
                <View style={modal.rowChips}>
                  {(['male', 'female'] as const).map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setForm((f) => ({ ...f, sex: s }))}
                      style={[modal.chip, form.sex === s && modal.chipActive]}
                    >
                      <Text style={[modal.chipText, form.sex === s && modal.chipTextActive]}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={modal.inputRow}>
                  <View style={modal.inputHalf}>
                    <Text style={modal.fieldLabel}>Age</Text>
                    <TextInput
                      style={modal.input}
                      keyboardType="numeric"
                      value={form.age != null ? String(form.age) : ''}
                      onChangeText={(v) => setForm((f) => ({ ...f, age: parseInt(v) || 0 }))}
                      placeholderTextColor={colors.textDim}
                    />
                  </View>
                  <View style={modal.inputHalf}>
                    <Text style={modal.fieldLabel}>Height (cm)</Text>
                    <TextInput
                      style={modal.input}
                      keyboardType="decimal-pad"
                      value={form.height_cm != null ? String(form.height_cm) : ''}
                      onChangeText={(v) => setForm((f) => ({ ...f, height_cm: parseFloat(v) || 0 }))}
                      placeholderTextColor={colors.textDim}
                    />
                  </View>
                </View>

                <Text style={modal.fieldLabel}>Weight (kg)</Text>
                <TextInput
                  style={modal.input}
                  keyboardType="decimal-pad"
                  value={weightDraft}
                  onChangeText={(v) => {
                    const nextValue = sanitizeDecimalInput(v);
                    setWeightDraft(nextValue);
                    setForm((f) => ({
                      ...f,
                      weight_kg: nextValue === '' || nextValue === '.' ? 0 : parseFloat(nextValue) || 0,
                    }));
                  }}
                  placeholderTextColor={colors.textDim}
                />
              </>
            ) : (
              <>
                <Text style={modal.fieldLabel}>Activity Level</Text>
                {ACTIVITY_OPTIONS.map((lvl) => (
                  <Pressable
                    key={lvl.id}
                    onPress={() => setForm((f) => ({ ...f, activity_level: lvl.id }))}
                    style={[modal.activityRow, form.activity_level === lvl.id && modal.activityRowActive]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[modal.activityLabel, form.activity_level === lvl.id && modal.activityLabelActive]}>
                        {lvl.label}
                      </Text>
                      <Text style={modal.activityDesc}>{lvl.desc}</Text>
                    </View>
                    {form.activity_level === lvl.id && (
                      <MaterialCommunityIcons color={colors.primary} name="check-circle" size={18} />
                    )}
                  </Pressable>
                ))}

                <Text style={[modal.fieldLabel, { marginTop: 16 }]}>Body Fat % (Optional)</Text>
                <TextInput
                  style={modal.input}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 15"
                  value={form.body_fat_percentage != null ? String(form.body_fat_percentage) : ''}
                  onChangeText={(v) =>
                    setForm((f) => ({ ...f, body_fat_percentage: v ? parseFloat(v) : undefined }))
                  }
                  placeholderTextColor={colors.textDim}
                />
                <Text style={modal.hint}>If provided, BMR will use the Katch-McArdle formula.</Text>
              </>
            )}
          </ScrollView>

          {error ? <Text style={modal.errorText}>{error}</Text> : null}

          <View style={modal.footer}>
            {step > 0 ? (
              <Pressable style={modal.backBtn} onPress={() => setStep(0)}>
                <Text style={modal.backBtnText}>Back</Text>
              </Pressable>
            ) : null}
            {step === 0 ? (
              <Pressable style={modal.primaryBtn} onPress={() => setStep(1)}>
                <Text style={modal.primaryBtnText}>Next Step</Text>
                <MaterialCommunityIcons color="#fff" name="arrow-right" size={16} />
              </Pressable>
            ) : (
              <Pressable
                style={[modal.primaryBtn, isSaving && modal.btnDisabled]}
                onPress={() => { void handleSave(); }}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={modal.primaryBtnText}>Save Specs</Text>
                    <MaterialCommunityIcons color="#fff" name="check" size={16} />
                  </>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── SetGoalModal ─────────────────────────────────────────────────────────────

const GOAL_TYPE_OPTIONS: { id: GoalType; label: string; icon: string; color: string }[] = [
  { id: 'cutting',       label: 'Fat Loss',    icon: 'fire',          color: '#f97316' },
  { id: 'lean_bulk',     label: 'Muscle Gain', icon: 'dumbbell',      color: '#3b82f6' },
  { id: 'maintain',      label: 'Maintenance', icon: 'scale-balance', color: '#22c55e' },
  { id: 'recomposition', label: 'Recomp',      icon: 'refresh',       color: '#a855f7' },
];

const GOAL_SPEED_OPTIONS: GoalSpeed[] = ['slow', 'moderate', 'aggressive'];

function SetGoalModal({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calcResult, setCalcResult] = useState<GoalCalculationResult | null>(null);

  const [form, setForm] = useState<GoalCalculationParams>({
    age: 25,
    sex: 'male',
    height_cm: 175,
    weight_kg: 75,
    activity_level: 'moderate',
    goal_type: 'maintain',
    goal_speed: 'moderate',
  });

  const loadMetrics = useCallback(async () => {
    const latest = await fetchLatestMetrics();
    if (latest) setForm((prev) => ({ ...prev, ...latest }));
  }, []);

  useEffect(() => {
    if (visible) {
      setStep(0);
      setCalcResult(null);
      setError(null);
      void loadMetrics();
    }
  }, [visible, loadMetrics]);

  const handleCalculate = async () => {
    setIsCalculating(true);
    setError(null);
    try {
      const result = await calculateGoalTargets(form);
      setCalcResult(result);
      setStep(1);
    } catch (err: any) {
      setError(err?.message ?? 'Calculation failed');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSave = async () => {
    if (!calcResult) return;
    setIsSaving(true);
    setError(null);
    try {
      await saveNutritionGoalTargets({ ...form, ...calcResult });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save goal');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <View style={modal.header}>
            <View>
              <Text style={modal.kicker}>Make Goal</Text>
              <View style={modal.stepDotsRow}>
                {[0, 1].map((i) => (
                  <View key={i} style={[modal.stepDot, i <= step && modal.stepDotActive]} />
                ))}
              </View>
            </View>
            <Pressable onPress={onClose} style={modal.closeBtn}>
              <MaterialCommunityIcons color={colors.textDim} name="close" size={20} />
            </Pressable>
          </View>

          <Text style={modal.stepTitle}>{step === 0 ? 'Goal' : 'Your Protocol'}</Text>

          <ScrollView style={modal.scroll} contentContainerStyle={modal.scrollContent}>
            {step === 0 ? (
              <>
                <Text style={modal.fieldLabel}>What's your goal?</Text>
                <View style={modal.goalTypeGrid}>
                  {GOAL_TYPE_OPTIONS.map((g) => (
                    <Pressable
                      key={g.id}
                      onPress={() => setForm((f) => ({ ...f, goal_type: g.id }))}
                      style={[
                        modal.goalTypeCard,
                        form.goal_type === g.id && { borderColor: g.color, backgroundColor: `${g.color}18` },
                      ]}
                    >
                      <MaterialCommunityIcons
                        color={form.goal_type === g.id ? g.color : colors.textDim}
                        name={g.icon}
                        size={28}
                      />
                      <Text style={[modal.goalTypeLabel, form.goal_type === g.id && { color: g.color }]}>
                        {g.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[modal.fieldLabel, { marginTop: 20 }]}>Intensity</Text>
                <View style={modal.rowChips}>
                  {GOAL_SPEED_OPTIONS.map((speed) => (
                    <Pressable
                      key={speed}
                      onPress={() => setForm((f) => ({ ...f, goal_speed: speed }))}
                      style={[modal.chip, { flex: 1 }, form.goal_speed === speed && modal.chipActive]}
                    >
                      <Text style={[modal.chipText, form.goal_speed === speed && modal.chipTextActive]}>
                        {speed.charAt(0).toUpperCase() + speed.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

              </>
            ) : calcResult ? (
              <>
                <View style={modal.statsRow}>
                  <View style={modal.statCard}>
                    <Text style={modal.statLabel}>BMR</Text>
                    <Text style={modal.statValue}>
                      {calcResult.bmr}<Text style={modal.statUnit}> kcal</Text>
                    </Text>
                  </View>
                  <View style={modal.statCard}>
                    <Text style={modal.statLabel}>TDEE</Text>
                    <Text style={modal.statValue}>
                      {calcResult.tdee}<Text style={modal.statUnit}> kcal</Text>
                    </Text>
                  </View>
                </View>

                <View style={modal.heroCard}>
                  <Text style={modal.heroLabel}>Target Protocol</Text>
                  <Text style={modal.heroCalories}>{calcResult.daily_calories}</Text>
                  <Text style={modal.heroSub}>Calories Per Day</Text>
                </View>

                <View style={modal.macrosRow}>
                  {[
                    { label: 'Protein', value: `${calcResult.protein_g}g`, color: '#a855f7' },
                    { label: 'Carbs',   value: `${calcResult.carbs_g}g`,   color: '#3b82f6' },
                    { label: 'Fat',     value: `${calcResult.fat_g}g`,     color: '#ec4899' },
                  ].map((m) => (
                    <View key={m.label} style={[modal.macroCard, { borderTopColor: m.color, borderTopWidth: 2 }]}>
                      <Text style={modal.macroLabel}>{m.label}</Text>
                      <Text style={[modal.macroValue, { color: m.color }]}>{m.value}</Text>
                    </View>
                  ))}
                </View>

                <View style={[modal.statCard, { flexDirection: 'row', alignItems: 'center', gap: 10,
                  backgroundColor: 'rgba(6,182,212,0.08)', borderColor: 'rgba(6,182,212,0.22)' }]}>
                  <MaterialCommunityIcons color="#06b6d4" name="water" size={20} />
                  <View>
                    <Text style={modal.statLabel}>Hydration Target</Text>
                    <Text style={[modal.statValue, { color: '#06b6d4' }]}>
                      {(calcResult.hydration_ml / 1000).toFixed(1)}<Text style={modal.statUnit}> L/day</Text>
                    </Text>
                  </View>
                </View>
              </>
            ) : null}
          </ScrollView>

          {error ? <Text style={modal.errorText}>{error}</Text> : null}

          <View style={modal.footer}>
            {step > 0 ? (
              <Pressable style={modal.backBtn} onPress={() => setStep(0)}>
                <Text style={modal.backBtnText}>Back</Text>
              </Pressable>
            ) : null}
            {step === 0 ? (
              <Pressable
                style={[modal.primaryBtn, isCalculating && modal.btnDisabled]}
                onPress={() => { void handleCalculate(); }}
                disabled={isCalculating}
              >
                {isCalculating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={modal.primaryBtnText}>Generate Plan</Text>
                    <MaterialCommunityIcons color="#fff" name="arrow-right" size={16} />
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable
                style={[modal.primaryBtn, isSaving && modal.btnDisabled]}
                onPress={() => { void handleSave(); }}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={modal.primaryBtnText}>Commit Goal</Text>
                    <MaterialCommunityIcons color="#fff" name="flash" size={16} />
                  </>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── ProfileScreen ────────────────────────────────────────────────────────────

export function ProfileScreen() {
  const today = new Date();
  const { user, logout } = useAuth();
  const userQuery = useQuery({ queryKey: ['me'], queryFn: getCurrentUser });
  const summaryQuery = useQuery({
    queryKey: ['summary', getCurrentMonth()],
    queryFn: () => getSummary(getCurrentMonth()),
  });
  const [specsVisible, setSpecsVisible] = useState(false);
  const [goalVisible, setGoalVisible] = useState(false);
  const [recordVisible, setRecordVisible] = useState(false);
  const [recordSearch, setRecordSearch] = useState('');
  const [selectedRecordName, setSelectedRecordName] = useState<string | null>(null);

  const profile = userQuery.data ?? user;
  const summary = summaryQuery.data;
  const displayName = (profile?.username ?? profile?.fullname ?? 'Profile').trim() || 'Profile';
  const daysJoined = useMemo(() => {
    if (!profile?.created_at) return '-';
    const joinedAt = new Date(profile.created_at);
    if (Number.isNaN(joinedAt.getTime())) return '-';
    return String(Math.max(0, differenceInCalendarDays(new Date(), joinedAt)));
  }, [profile?.created_at]);

  const initials = useMemo(() => {
    const name = displayName.trim();
    if (!name) return '';
    const parts = name.split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || name[0]?.toUpperCase() || '';
  }, [displayName]);

  const recordRows = useMemo(() => {
    const exercises = summary?.exercise_data ?? [];
    return exercises.slice(0, 3).map((exercise, idx) => ({
      name: exercise.name,
      value: `${Math.round(
        Math.max(0, ...(exercise.history ?? []).map((entry) => Number(entry.weight) || 0)),
      )} kg`,
      updated: `${exercise.count} sessions`,
      icon: idx === 0 ? 'dumbbell' : idx === 1 ? 'human-handsup' : 'weight-lifter',
    }));
  }, [summary]);

  const allRecords = useMemo(() => summary?.exercise_data ?? [], [summary]);

  const filteredRecords = useMemo(() => {
    const query = recordSearch.trim().toLowerCase();
    if (!query) return allRecords;
    return allRecords.filter((record) => record.name.toLowerCase().includes(query));
  }, [allRecords, recordSearch]);

  const selectedRecord = useMemo(() => {
    if (!selectedRecordName) return filteredRecords[0] ?? allRecords[0] ?? null;
    return allRecords.find((record) => record.name === selectedRecordName) ?? null;
  }, [allRecords, filteredRecords, selectedRecordName]);

  return (
    <Screen scroll contentStyle={styles.screen}>
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerKicker}>Ascent</Text>
          <Text style={styles.headerTitle}>PROFILE</Text>
          <Text style={styles.dateText}>{format(today, 'MMM dd, yyyy')}</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <View style={styles.avatarRing}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials || '?'}</Text>
          </View>
          <View style={styles.verifiedBadge}>
            <MaterialCommunityIcons color="#fff" name="check" size={12} />
          </View>
        </View>
        <Text style={styles.displayName}>{displayName}</Text>
        <View style={styles.tierRow}>
          <Text style={styles.tierText}>Elite Tier</Text>
          <View style={styles.dot} />
          <Text style={styles.levelText}>Level 42</Text>
        </View>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Active Status: Connected</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statTile}>
          <Text style={styles.statLabel}>Total Weight</Text>
          <Text style={styles.statValue}>
            {summary ? formatVolume(summary.total_volume) : '--'} <Text style={styles.statUnit}>kg</Text>
          </Text>
          <Text style={styles.statTrend}>{summary ? `${summary.gr_score_change >= 0 ? '+' : ''}${summary.gr_score_change}%` : '--'}</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statLabel}>Workouts</Text>
          <Text style={styles.statValue}>{summary ? summary.total_workouts : '--'}</Text>
          <Text style={styles.statTrend}>GR {summary ? summary.gr_score : '--'}</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statLabel}>Active Streak</Text>
          <Text style={styles.statValue}>{summary ? summary.longest_streak : '--'} <Text style={styles.statUnit}>days</Text></Text>
          <Text style={styles.statTrend}>{summary ? `${Math.round(summary.calories_avg)} kcal avg` : '--'}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>User Information</Text>
      <View style={styles.infoCard}>
        {[
          { label: 'Username', value: displayName },
          { label: 'Email', value: profile?.email ?? '-' },
          { label: 'Days Joined', value: daysJoined === '-' ? '-' : `${daysJoined} days` },
        ].map((row, idx, arr) => (
          <View key={row.label}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{row.label}</Text>
              <Text style={styles.infoValue}>{row.value}</Text>
            </View>
            {idx < arr.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Personal Records (MAX_KG)</Text>
        <Pressable onPress={() => setRecordVisible(true)}>
          <Text style={styles.viewAll}>View All</Text>
        </Pressable>
      </View>
      <View style={styles.recordsList}>
        {recordRows.length === 0 ? (
          <Text style={styles.recordSub}>No exercise records available yet.</Text>
        ) : (
          recordRows.map((record) => (
            <View key={record.name} style={styles.recordRow}>
              <View style={styles.recordIconBox}>
                <MaterialCommunityIcons color={colors.primary} name={record.icon} size={18} />
              </View>
              <View style={styles.recordTextWrap}>
                <Text style={styles.recordTitle}>{record.name}</Text>
                <Text style={styles.recordSub}>{record.updated}</Text>
              </View>
              <Text style={styles.recordValue}>{record.value}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>System Configuration</Text>
      <View style={styles.actionsCard}>
        <Pressable style={styles.actionRow} onPress={() => setSpecsVisible(true)}>
          <View style={styles.actionIconBox}>
            <MaterialCommunityIcons color={colors.textDim} name="human-male-height" size={20} />
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Save Current Specs</Text>
            <Text style={styles.actionSub}>Update your measurements and activity</Text>
          </View>
          <MaterialCommunityIcons color={colors.textDim} name="chevron-right" size={20} />
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.actionRow} onPress={() => setGoalVisible(true)}>
          <View style={styles.actionIconBox}>
            <MaterialCommunityIcons color={colors.textDim} name="flag-checkered" size={20} />
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Set Goal</Text>
            <Text style={styles.actionSub}>Calculate and commit nutrition targets</Text>
          </View>
          <MaterialCommunityIcons color={colors.textDim} name="chevron-right" size={20} />
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.actionRow}>
          <View style={styles.actionIconBox}>
            <MaterialCommunityIcons color={colors.textDim} name="bell-outline" size={20} />
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Notifications</Text>
            <Text style={styles.actionSub}>Enabled</Text>
          </View>
          <MaterialCommunityIcons color={colors.textDim} name="chevron-right" size={20} />
        </Pressable>
      </View>

      <Pressable
        style={styles.logoutBtn}
        onPress={() => {
          Alert.alert('Log Out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log Out', style: 'destructive', onPress: () => void logout() },
          ]);
        }}
      >
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>

      <Modal
        visible={recordVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRecordVisible(false)}
      >
        <View style={styles.recordModalOverlay}>
          <View style={styles.recordModalCard}>
            <View style={styles.recordModalHeader}>
              <Text style={styles.recordModalTitle}>Personal Records</Text>
              <Pressable onPress={() => setRecordVisible(false)}>
                <MaterialCommunityIcons color={colors.textDim} name="close" size={20} />
              </Pressable>
            </View>

            <View style={styles.recordSearchWrap}>
              <MaterialCommunityIcons color={colors.textDim} name="magnify" size={18} />
              <TextInput
                value={recordSearch}
                onChangeText={setRecordSearch}
                placeholder="Search exercise..."
                placeholderTextColor={colors.textDim}
                style={styles.recordSearchInput}
              />
            </View>

            <ScrollView style={styles.recordList} horizontal>
              <View style={styles.recordChipRow}>
                {filteredRecords.map((record) => {
                  const active = (selectedRecord?.name ?? '') === record.name;
                  return (
                    <Pressable
                      key={record.name}
                      style={[styles.recordChip, active && styles.recordChipActive]}
                      onPress={() => setSelectedRecordName(record.name)}
                    >
                      <Text style={[styles.recordChipText, active && styles.recordChipTextActive]}>
                        {record.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {selectedRecord ? (
              <View style={styles.recordChartWrap}>
                <Text style={styles.recordChartTitle}>{selectedRecord.name}</Text>
                <Text style={styles.recordChartSub}>
                  Top weight history ({selectedRecord.history.length} logs)
                </Text>
                {selectedRecord.history.length > 0 ? (
                  <ScrollView horizontal>
                    <PersonalRecordChart data={selectedRecord.history.map((h) => ({ date: h.date, weight: h.weight }))} />
                  </ScrollView>
                ) : (
                  <Text style={styles.recordSub}>No historical record points.</Text>
                )}
              </View>
            ) : (
              <Text style={styles.recordSub}>No exercise records available yet.</Text>
            )}
          </View>
        </View>
      </Modal>

      <UpdateSpecsModal
        visible={specsVisible}
        onClose={() => setSpecsVisible(false)}
        onSuccess={() => Alert.alert('Saved', 'Your body specs have been updated.')}
      />
      <SetGoalModal
        visible={goalVisible}
        onClose={() => setGoalVisible(false)}
        onSuccess={() => Alert.alert('Goal Set', 'Your nutrition goal has been committed.')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#101722',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 34,
    gap: 14,
  },
  headerBar: {
    paddingVertical: 4,
  },
  headerKicker: {
    color: colors.primary,
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dateText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(60,131,246,0.2)',
    backgroundColor: 'rgba(60,131,246,0.05)',
    alignItems: 'center',
    paddingVertical: 20,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    right: -38,
    top: -38,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(60,131,246,0.22)',
  },
  avatarRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(60,131,246,0.18)',
    marginBottom: 10,
  },
  avatarCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: '#0a1322',
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    right: 8,
    bottom: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#101722',
  },
  avatarInitials: {
    color: '#dbeafe',
    fontSize: 34,
    fontWeight: '800',
  },
  displayName: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  tierText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#64748b',
  },
  levelText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  statusPill: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(60,131,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(60,131,246,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  statusText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statTile: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(60,131,246,0.2)',
    borderLeftWidth: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(60,131,246,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  statLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statValue: {
    marginTop: 4,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  statUnit: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  statTrend: {
    marginTop: 6,
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  viewAll: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  infoCard: {
    borderWidth: 1,
    borderColor: 'rgba(60,131,246,0.2)',
    backgroundColor: 'rgba(60,131,246,0.05)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoLabel: {
    color: colors.textDim,
    fontSize: 12,
  },
  infoValue: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    maxWidth: '65%',
    textAlign: 'right',
  },
  recordsList: {
    gap: 12,
    paddingBottom: 8,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(60,131,246,0.2)',
    backgroundColor: 'rgba(60,131,246,0.05)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 16,
    minHeight: 78,
  },
  recordIconBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(60,131,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordTextWrap: {
    flex: 1,
    gap: 2,
  },
  recordTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  recordSub: {
    color: colors.textDim,
    fontSize: 11,
  },
  recordValue: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(60,131,246,0.16)',
    marginHorizontal: 14,
  },
  actionsCard: {
    borderWidth: 1,
    borderColor: 'rgba(60,131,246,0.2)',
    backgroundColor: 'rgba(60,131,246,0.05)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  actionIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  actionText: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  actionSub: {
    color: colors.textDim,
    fontSize: 10,
  },
  logoutBtn: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  logoutText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  recordModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  recordModalCard: {
    backgroundColor: '#0c111b',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: 'rgba(60,131,246,0.2)',
    padding: 14,
    gap: 10,
    maxHeight: '85%',
  },
  recordModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordModalTitle: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  recordSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(60,131,246,0.25)',
    backgroundColor: 'rgba(10,19,34,0.95)',
    borderRadius: 8,
    gap: 8,
    paddingHorizontal: 10,
  },
  recordSearchInput: {
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: 10,
  },
  recordList: {
    maxHeight: 54,
  },
  recordChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  recordChip: {
    borderWidth: 1,
    borderColor: 'rgba(60,131,246,0.24)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(60,131,246,0.05)',
  },
  recordChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(60,131,246,0.2)',
  },
  recordChipText: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  recordChipTextActive: {
    color: colors.primary,
  },
  recordChartWrap: {
    borderWidth: 1,
    borderColor: 'rgba(60,131,246,0.18)',
    borderRadius: 10,
    backgroundColor: 'rgba(10,19,34,0.9)',
    padding: 14,
    gap: 6,
    minHeight: 360,
  },
  recordChartTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  recordChartSub: {
    color: colors.textDim,
    fontSize: 11,
  },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#0b0f17',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopColor: 'rgba(59,130,246,0.15)',
    borderLeftColor: 'rgba(59,130,246,0.15)',
    borderRightColor: 'rgba(59,130,246,0.15)',
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  kicker: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  stepDotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  stepDot: {
    width: 16,
    height: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  stepDotActive: {
    width: 32,
    backgroundColor: colors.primary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  scroll: {
    flexGrow: 0,
    maxHeight: 480,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  fieldLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  rowChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  chipText: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipTextActive: {
    color: colors.primary,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  inputHalf: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 10,
  },
  activityRowActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  activityLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  activityLabelActive: {
    color: colors.primary,
  },
  activityDesc: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  hint: {
    color: colors.textDim,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },
  goalTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  goalTypeCard: {
    width: '47%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 10,
  },
  goalTypeLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  statLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  statUnit: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '500',
  },
  heroCard: {
    borderRadius: 20,
    backgroundColor: colors.primary,
    paddingVertical: 28,
    alignItems: 'center',
    marginBottom: 4,
    gap: 4,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroCalories: {
    color: '#ffffff',
    fontSize: 54,
    fontWeight: '900',
    lineHeight: 60,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  macrosRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  macroCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  macroLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(59,130,246,0.12)',
  },
  backBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backBtnText: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  primaryBtn: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
});
