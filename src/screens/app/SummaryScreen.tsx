import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { eachMonthOfInterval, eachYearOfInterval, format, getDaysInMonth } from 'date-fns';
import { Screen } from '@/components/ui/Screen';
import { getSummary } from '@/services/summary';
import { colors } from '@/theme/tokens';

type SummaryTab = 'nutrition' | 'hydration';
type CalendarStep = 'year' | 'month';

type SummaryPoint = {
  label: string;
  dateLabel: string;
  workouts: number;
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  sugar: number;
  gr: number;
  water: number;
};

type SeriesConfig<T> = {
  key: keyof T;
  color: string;
  strokeWidth?: number;
  dashArray?: string;
};

const CHART_COLORS = {
  kcal: '#f97316',
  protein: '#a855f7',
  carbs: '#3b82f6',
  fats: '#ec4899',
  fiber: '#22c55e',
  sugar: '#ef4444',
  water: '#06b6d4',
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildPath<T>(
  data: T[],
  series: SeriesConfig<T>,
  width: number,
  height: number,
  maxY: number,
  padding: { top: number; right: number; bottom: number; left: number },
): string {
  if (data.length === 0) return '';

  const drawWidth = width - padding.left - padding.right;
  const drawHeight = height - padding.top - padding.bottom;

  return data
    .map((row, index) => {
      const raw = row[series.key];
      const value = toNumber(raw);
      const x = padding.left + (index / Math.max(1, data.length - 1)) * drawWidth;
      const y = padding.top + (1 - value / Math.max(1, maxY)) * drawHeight;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function MultiLineChart<T extends { dateLabel: string; label: string }>(props: {
  data: T[];
  series: Array<SeriesConfig<T>>;
  height: number;
  width: number;
}) {
  const padding = { top: 18, right: 14, bottom: 30, left: 28 };
  const maxY = useMemo(() => {
    const values = props.data.flatMap((row) => props.series.map((line) => toNumber(row[line.key])));
    return Math.max(1, ...values);
  }, [props.data, props.series]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((v) => Math.round(maxY * v));

  return (
    <Svg width={props.width} height={props.height}>
      {yTicks.map((tick, idx) => {
        const y = padding.top + (1 - tick / Math.max(1, maxY)) * (props.height - padding.top - padding.bottom);
        return (
          <View key={`grid-${idx}`}>
            <Line x1={padding.left} y1={y} x2={props.width - padding.right} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="6 6" />
            <SvgText x={6} y={y + 4} fill={colors.textDim} fontSize="9">
              {tick}
            </SvgText>
          </View>
        );
      })}

      {props.data
        .map((item, index) => ({ item, index }))
        .filter(({ index }) => index % 5 === 0 || index === props.data.length - 1)
        .map(({ item, index }) => {
          const x = padding.left + (index / Math.max(1, props.data.length - 1)) * (props.width - padding.left - padding.right);
          return (
            <SvgText key={`x-${item.dateLabel}`} x={x} y={props.height - 12} fill={colors.textDim} fontSize="9">
              {item.label}
            </SvgText>
          );
        })}

      {props.series.map((line) => (
        <Path
          key={String(line.key)}
          d={buildPath(props.data, line, props.width, props.height, maxY, padding)}
          fill="none"
          stroke={line.color}
          strokeWidth={line.strokeWidth ?? 3}
          strokeDasharray={line.dashArray}
        />
      ))}
    </Svg>
  );
}

function CircularProgress(props: {
  value: number;
  max: number;
  label: string;
  unit?: string;
  icon: string;
  strokeColor: string;
}) {
  const size = 132;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = props.max <= 0 ? 0 : Math.max(0, Math.min(100, (props.value / props.max) * 100));
  const offset = circumference * (1 - pct / 100);

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressSvgWrap}>
        <Svg height={size} width={size}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} fill="transparent" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={props.strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            fill="transparent"
            originX={size / 2}
            originY={size / 2}
            rotation={-90}
          />
        </Svg>
        <View style={styles.progressCenter}>
          <MaterialCommunityIcons color={props.strokeColor} name={props.icon} size={18} />
          <Text style={styles.progressValue}>
            {Math.round(props.value)}
            {props.unit ? <Text style={styles.progressUnit}>{props.unit}</Text> : null}
          </Text>
          <Text style={styles.progressPct}>{Math.round(pct)}%</Text>
        </View>
      </View>
      <Text style={styles.progressLabel}>{props.label}</Text>
      <Text style={styles.progressSubLabel}>
        {Math.round(props.value)}/{props.max}
      </Text>
    </View>
  );
}

export function SummaryScreen() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarStep, setCalendarStep] = useState<CalendarStep>('year');

  const [activeTab, setActiveTab] = useState<SummaryTab>('nutrition');
  const [dataset, setDataset] = useState<SummaryPoint[]>([]);

  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const years = useMemo(
    () => eachYearOfInterval({ start: new Date(1900, 0, 1), end: new Date(2100, 0, 1) }),
    [],
  );

  const months = useMemo(
    () => eachMonthOfInterval({ start: new Date(selectedYear, 0, 1), end: new Date(selectedYear, 11, 1) }),
    [selectedYear],
  );

  const loadSummaryData = useCallback(async () => {
    setIsLoadingSummary(true);

    try {
      const monthParam = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
      const payload = await getSummary(monthParam);

      const daysInMonth = getDaysInMonth(new Date(selectedYear, selectedMonth, 1));
      const dayMap = new Map((payload.daily_data ?? []).map((day) => [day.date.slice(0, 10), day]));
      const nextDataset: SummaryPoint[] = [];

      for (let i = 1; i <= daysInMonth; i += 1) {
        const isoDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const serverDay = dayMap.get(isoDate);

        nextDataset.push({
          label: String(i).padStart(2, '0'),
          dateLabel: `${String(i).padStart(2, '0')}/${String(selectedMonth + 1).padStart(2, '0')}/${selectedYear}`,
          workouts: toNumber(serverDay?.workouts),
          kcal: toNumber(serverDay?.kcal),
          protein: toNumber(serverDay?.protein),
          carbs: toNumber(serverDay?.carbs),
          fats: toNumber(serverDay?.fats),
          fiber: toNumber(serverDay?.fiber),
          sugar: toNumber(serverDay?.sugar),
          gr: toNumber(serverDay?.gr),
          water: toNumber(serverDay?.water),
        });
      }

      setDataset(nextDataset);
    } catch {
      setDataset([]);
    } finally {
      setIsLoadingSummary(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    void loadSummaryData();
  }, [loadSummaryData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadSummaryData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const totals = useMemo(() => {
    const days = dataset.length || getDaysInMonth(new Date(selectedYear, selectedMonth, 1));
    const aggregate = dataset.reduce(
      (acc, day) => ({
        workouts: acc.workouts + day.workouts,
        kcal: acc.kcal + day.kcal,
        protein: acc.protein + day.protein,
        gr: acc.gr + day.gr,
        workoutDays: acc.workoutDays + (day.workouts > 0 ? 1 : 0),
      }),
      { workouts: 0, kcal: 0, protein: 0, gr: 0, workoutDays: 0 },
    );

    return {
      totalWorkouts: aggregate.workouts,
      avgKcal: Math.round(aggregate.kcal / Math.max(1, days)),
      avgProtein: Math.round(aggregate.protein / Math.max(1, days)),
      avgGR: Math.round(aggregate.gr / Math.max(1, aggregate.workoutDays)),
    };
  }, [dataset, selectedMonth, selectedYear]);

  const chartWidth = Math.max(320, Dimensions.get('window').width - 54);

  return (
    <Screen scroll contentStyle={styles.screen} refreshing={isRefreshing} onRefresh={handleRefresh}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Summary</Text>
          <Text style={styles.subtitle}>Monthly performance snapshot.</Text>
        </View>
      </View>

      <View style={styles.periodWrap}>
        <Pressable
          onPress={() => {
            setCalendarStep('year');
            setIsCalendarOpen(true);
          }}
          style={styles.periodBtn}
        >
          <Text style={styles.periodLabel}>Select Period</Text>
          <View style={styles.periodValuesRow}>
            <Text style={styles.periodMonth}>{format(new Date(selectedYear, selectedMonth, 1), 'MMM')}</Text>
            <Text style={styles.periodYear}>{selectedYear}</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.progressGrid}>
        <CircularProgress value={totals.totalWorkouts} max={20} label="WORKOUTS" icon="dumbbell" strokeColor="#3b82f6" />
        <CircularProgress value={totals.avgKcal} max={3500} label="AVG KCAL" icon="fire" strokeColor="#f97316" />
        <CircularProgress value={totals.avgProtein} max={250} label="AVG PROTEIN" unit="g" icon="egg" strokeColor="#a855f7" />
        <CircularProgress value={totals.avgGR} max={100} label="GR SCORE" icon="flash" strokeColor={colors.primary} />
      </View>

      <View style={styles.tabsRow}>
        <Pressable onPress={() => setActiveTab('nutrition')} style={[styles.tabBtn, activeTab === 'nutrition' ? styles.tabBtnActive : styles.tabBtnInactive]}>
          <Text style={[styles.tabText, activeTab === 'nutrition' ? styles.tabTextActive : undefined]}>Nutrition</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab('hydration')} style={[styles.tabBtn, activeTab === 'hydration' ? styles.tabBtnActive : styles.tabBtnInactive]}>
          <Text style={[styles.tabText, activeTab === 'hydration' ? styles.tabTextActive : undefined]}>Hydration</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        {activeTab === 'nutrition' ? (
          <>
            <Text style={styles.cardTitle}>Complete Nutrition Profile</Text>
            <Text style={styles.cardSubtitle}>All macros and calories per day</Text>
            <View style={styles.chartWrap}>
              <MultiLineChart
                width={chartWidth}
                height={340}
                data={dataset}
                series={[
                  { key: 'kcal', color: CHART_COLORS.kcal, strokeWidth: 3 },
                  { key: 'protein', color: CHART_COLORS.protein, strokeWidth: 3 },
                  { key: 'carbs', color: CHART_COLORS.carbs, strokeWidth: 3 },
                  { key: 'fats', color: CHART_COLORS.fats, strokeWidth: 3 },
                  { key: 'fiber', color: CHART_COLORS.fiber, strokeWidth: 3 },
                  { key: 'sugar', color: CHART_COLORS.sugar, strokeWidth: 3 },
                ]}
              />
            </View>
            <View style={styles.legendRow}>
              {[
                ['Kcal', CHART_COLORS.kcal],
                ['Protein', CHART_COLORS.protein],
                ['Carbs', CHART_COLORS.carbs],
                ['Fats', CHART_COLORS.fats],
                ['Fiber', CHART_COLORS.fiber],
                ['Sugar', CHART_COLORS.sugar],
              ].map(([name, color]) => (
                <View key={name} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: color }]} />
                  <Text style={styles.legendText}>{name}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.cardTitle}>Hydration</Text>
            <Text style={styles.cardSubtitle}>Water intake per day (ml)</Text>
            <View style={styles.chartWrap}>
              <MultiLineChart
                width={chartWidth}
                height={340}
                data={dataset}
                series={[{ key: 'water', color: CHART_COLORS.water, strokeWidth: 4 }]}
              />
            </View>
          </>
        )}
      </View>

      <Modal visible={isCalendarOpen} transparent animationType="fade" onRequestClose={() => setIsCalendarOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModal}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>{calendarStep === 'year' ? 'Select a Year' : `Year ${selectedYear}`}</Text>
              <Pressable onPress={() => setIsCalendarOpen(false)}>
                <MaterialCommunityIcons color={colors.textPrimary} name="close" size={20} />
              </Pressable>
            </View>

            <View style={styles.calendarStepRow}>
              <Pressable onPress={() => setCalendarStep('year')} style={[styles.stepBtn, calendarStep === 'year' ? styles.stepBtnActive : undefined]}>
                <Text style={styles.stepBtnText}>Year</Text>
              </Pressable>
              <Pressable disabled={calendarStep === 'year'} onPress={() => setCalendarStep('month')} style={[styles.stepBtn, calendarStep === 'month' ? styles.stepBtnActive : undefined]}>
                <Text style={styles.stepBtnText}>Month</Text>
              </Pressable>
            </View>

            {calendarStep === 'year' ? (
              <FlatList
                data={years}
                numColumns={4}
                keyExtractor={(item) => String(item.getFullYear())}
                contentContainerStyle={styles.yearGrid}
                renderItem={({ item }) => {
                  const year = item.getFullYear();
                  const active = year === selectedYear;
                  return (
                    <Pressable
                      onPress={() => {
                        setSelectedYear(year);
                        setCalendarStep('month');
                      }}
                      style={[styles.yearCell, active ? styles.yearCellActive : undefined]}
                    >
                      <Text style={[styles.yearText, active ? styles.yearTextActive : undefined]}>{year}</Text>
                    </Pressable>
                  );
                }}
                style={styles.yearList}
              />
            ) : (
              <View style={styles.monthGrid}>
                {months.map((monthDate) => {
                  const monthIndex = monthDate.getMonth();
                  const active = monthIndex === selectedMonth;
                  return (
                    <Pressable
                      key={monthIndex}
                      onPress={() => {
                        setSelectedMonth(monthIndex);
                        setIsCalendarOpen(false);
                      }}
                      style={[styles.monthCell, active ? styles.monthCellActive : undefined]}
                    >
                      <Text style={[styles.monthText, active ? styles.monthTextActive : undefined]}>{format(monthDate, 'MMM')}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {isLoadingSummary ? (
        <View style={styles.loadingOverlay}>
          <Text style={styles.emptyText}>Loading summary data...</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 3,
  },
  periodWrap: {
    maxWidth: 220,
  },
  periodBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.surfaceCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  periodLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  periodValuesRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  periodMonth: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
  periodYear: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
  },
  progressGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 20,
  },
  progressWrap: {
    width: '48%',
    alignItems: 'center',
  },
  progressSvgWrap: {
    position: 'relative',
    width: 132,
    height: 132,
  },
  progressCenter: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  progressValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  progressUnit: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
  },
  progressPct: {
    color: colors.textDim,
    fontSize: 10,
  },
  progressLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    marginTop: 8,
  },
  progressSubLabel: {
    color: colors.textDim,
    fontSize: 9,
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabBtnInactive: {
    backgroundColor: colors.surfaceCard,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDim,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  card: {
    borderRadius: 24,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    gap: 8,
  },
  subTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  subTabBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  subTabBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  subTabBtnInactive: {
    backgroundColor: colors.surfaceDark,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  subTabText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardSubtitle: {
    color: colors.textDim,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  chartWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginTop: 6,
    backgroundColor: '#0b1220',
  },
  chartWrapSmall: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginTop: 8,
    backgroundColor: '#0b1220',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendText: {
    color: colors.textDim,
    fontSize: 10,
  },
  selectLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  exerciseList: {
    paddingVertical: 6,
    gap: 8,
  },
  exerciseChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: colors.surfaceDark,
  },
  exerciseChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  exerciseChipText: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  exerciseChipTextActive: {
    color: '#ffffff',
  },
  miniStatsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  miniStatCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.surfaceDark,
  },
  miniStatLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  miniStatValue: {
    color: colors.textPrimary,
    fontSize: 23,
    fontWeight: '800',
    marginTop: 8,
  },
  workoutPlaceholder: {
    borderRadius: 16,
    backgroundColor: colors.surfaceDark,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 13,
  },
  loadingOverlay: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  calendarModal: {
    width: '100%',
    maxWidth: 420,
    maxHeight: 500,
    borderRadius: 18,
    backgroundColor: '#0b0f17',
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 14,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  calendarStepRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 10,
  },
  stepBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: 'transparent',
  },
  stepBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  yearList: {
    maxHeight: 360,
  },
  yearGrid: {
    gap: 8,
  },
  yearCell: {
    width: '23%',
    marginHorizontal: '1%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    paddingVertical: 9,
    marginBottom: 8,
    alignItems: 'center',
  },
  yearCellActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  yearText: {
    color: colors.textDim,
    fontWeight: '700',
  },
  yearTextActive: {
    color: '#fff',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  monthCell: {
    width: '31%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    paddingVertical: 12,
    alignItems: 'center',
  },
  monthCellActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  monthText: {
    color: colors.textDim,
    fontWeight: '700',
  },
  monthTextActive: {
    color: '#fff',
  },
});
