import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import Svg, { Circle, G, Line, Rect, Text as SvgText } from "react-native-svg";
import {
  eachMonthOfInterval,
  eachYearOfInterval,
  format,
  getDaysInMonth,
} from "date-fns";
import { Screen } from "@/components/ui/Screen";
import { getSummary } from "@/services/summary";
import { colors } from "@/theme/tokens";

type CalendarStep = "year" | "month";

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
  kcal: "#f97316",
  protein: "#a855f7",
  carbs: "#3b82f6",
  fats: "#ec4899",
  fiber: "#22c55e",
  sugar: "#ef4444",
  water: "#06b6d4",
};

type NutritionKey = "kcal" | "protein" | "carbs" | "fats" | "fiber" | "sugar";

const NUTRITION_SERIES: Array<{
  key: NutritionKey;
  label: string;
  color: string;
}> = [
  { key: "kcal", label: "Kcal", color: CHART_COLORS.kcal },
  { key: "protein", label: "Protein", color: CHART_COLORS.protein },
  { key: "carbs", label: "Carbs", color: CHART_COLORS.carbs },
  { key: "fats", label: "Fats", color: CHART_COLORS.fats },
  { key: "fiber", label: "Fiber", color: CHART_COLORS.fiber },
  { key: "sugar", label: "Sugar", color: CHART_COLORS.sugar },
];

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function ColumnChart<T extends { dateLabel: string; label: string }>(props: {
  data: T[];
  series: Array<SeriesConfig<T>>;
  height: number;
  width: number;
}) {
  const padding = { top: 18, right: 14, bottom: 30, left: 36 };

  const maxY = useMemo(() => {
    const values = props.data.flatMap((row) =>
      props.series.map((s) => toNumber(row[s.key])),
    );
    return Math.max(1, ...values);
  }, [props.data, props.series]);

  const drawWidth = props.width - padding.left - padding.right;
  const drawHeight = props.height - padding.top - padding.bottom;
  const n = Math.max(1, props.data.length);
  const numSeries = Math.max(1, props.series.length);

  const groupWidth = drawWidth / n;
  const groupPad = Math.max(1, groupWidth * 0.18);
  const totalBarWidth = groupWidth - groupPad;
  const barGap = numSeries > 1 ? 1 : 0;
  const barWidth = Math.max(1, (totalBarWidth - barGap * (numSeries - 1)) / numSeries);

  const yTicks = [0, 0.5, 1].map((v) => Math.round(maxY * v));

  return (
    <Svg width={props.width} height={props.height}>
      {yTicks.map((tick, idx) => {
        const y = padding.top + (1 - tick / Math.max(1, maxY)) * drawHeight;
        const label =
          tick >= 1000
            ? `${(tick / 1000).toFixed(tick % 1000 === 0 ? 0 : 1)}k`
            : String(tick);
        return (
          <G key={`grid-${idx}`}>
            <Line
              x1={padding.left}
              y1={y}
              x2={props.width - padding.right}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 4"
            />
            <SvgText x={4} y={y + 4} fill={colors.textDim} fontSize="9">
              {label}
            </SvgText>
          </G>
        );
      })}

      {props.data.map((item, index) => {
        if (index % 5 !== 0 && index !== props.data.length - 1) return null;
        const cx = padding.left + (index + 0.5) * groupWidth;
        return (
          <SvgText
            key={`xl-${item.dateLabel}`}
            x={cx}
            y={props.height - 10}
            fill={colors.textDim}
            fontSize="9"
            textAnchor="middle"
          >
            {item.label}
          </SvgText>
        );
      })}

      {props.data.map((row, di) => {
        const groupStartX =
          padding.left + di * groupWidth + groupPad / 2;
        return props.series.map((s, si) => {
          const value = toNumber(row[s.key]);
          const barH = Math.max(
            0,
            (value / Math.max(1, maxY)) * drawHeight,
          );
          const bx = groupStartX + si * (barWidth + barGap);
          const by = padding.top + drawHeight - barH;
          return (
            <Rect
              key={`${String(s.key)}-${di}`}
              x={bx}
              y={by}
              width={barWidth}
              height={barH}
              fill={s.color}
              rx={Math.min(2, barWidth / 2)}
            />
          );
        });
      })}
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
  const pct =
    props.max <= 0
      ? 0
      : Math.max(0, Math.min(100, (props.value / props.max) * 100));
  const offset = circumference * (1 - pct / 100);

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressSvgWrap}>
        <Svg height={size} width={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
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
          <MaterialCommunityIcons
            color={props.strokeColor}
            name={props.icon}
            size={18}
          />
          <Text style={styles.progressValue}>
            {Math.round(props.value)}
            {props.unit ? (
              <Text style={styles.progressUnit}>{props.unit}</Text>
            ) : null}
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
  const [calendarStep, setCalendarStep] = useState<CalendarStep>("year");
  const [activeNutritionKeys, setActiveNutritionKeys] = useState<
    Set<NutritionKey>
  >(new Set(["protein", "carbs"] as NutritionKey[]));
  const [dataset, setDataset] = useState<SummaryPoint[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const years = useMemo(
    () =>
      eachYearOfInterval({
        start: new Date(1900, 0, 1),
        end: new Date(2100, 0, 1),
      }),
    [],
  );

  const months = useMemo(
    () =>
      eachMonthOfInterval({
        start: new Date(selectedYear, 0, 1),
        end: new Date(selectedYear, 11, 1),
      }),
    [selectedYear],
  );

  const loadSummaryData = useCallback(async () => {
    setIsLoadingSummary(true);

    try {
      const monthParam = `${selectedYear}-${String(selectedMonth + 1).padStart(
        2,
        "0",
      )}`;
      const payload = await getSummary(monthParam);
      const daysInMonth = getDaysInMonth(
        new Date(selectedYear, selectedMonth, 1),
      );
      const dayMap = new Map(
        (payload.daily_data ?? []).map((day) => [day.date.slice(0, 10), day]),
      );
      const nextDataset: SummaryPoint[] = [];

      for (let i = 1; i <= daysInMonth; i += 1) {
        const isoDate = `${selectedYear}-${String(selectedMonth + 1).padStart(
          2,
          "0",
        )}-${String(i).padStart(2, "0")}`;
        const serverDay = dayMap.get(isoDate);

        nextDataset.push({
          label: String(i).padStart(2, "0"),
          dateLabel: `${String(i).padStart(2, "0")}/${String(
            selectedMonth + 1,
          ).padStart(2, "0")}/${selectedYear}`,
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
    const days =
      dataset.length ||
      getDaysInMonth(new Date(selectedYear, selectedMonth, 1));
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

  const chartWidth = Math.max(320, Dimensions.get("window").width - 54);

  return (
    <Screen
      scroll
      contentStyle={styles.screen}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.systemStatus}>Ascent</Text>
          <Text style={styles.title}>SUMMARY</Text>
          <Text style={styles.dateText}>
            {format(now, "MMM dd, yyyy")}
          </Text>
        </View>
      </View>

      <View style={styles.periodWrap}>
        <Pressable
          onPress={() => {
            setCalendarStep("year");
            setIsCalendarOpen(true);
          }}
          style={styles.periodBtn}
        >
          <Text style={styles.periodLabel}>Select Period</Text>
          <View style={styles.periodValuesRow}>
            <Text style={styles.periodMonth}>
              {format(new Date(selectedYear, selectedMonth, 1), "MMM")}
            </Text>
            <Text style={styles.periodYear}>{selectedYear}</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.progressGrid}>
        <CircularProgress
          value={totals.totalWorkouts}
          max={20}
          label="WORKOUTS"
          icon="dumbbell"
          strokeColor="#3b82f6"
        />
        <CircularProgress
          value={totals.avgKcal}
          max={3500}
          label="AVG KCAL"
          icon="fire"
          strokeColor="#f97316"
        />
        <CircularProgress
          value={totals.avgProtein}
          max={250}
          label="AVG PROTEIN"
          unit="g"
          icon="egg"
          strokeColor="#a855f7"
        />
        <CircularProgress
          value={totals.avgGR}
          max={100}
          label="GR SCORE"
          icon="flash"
          strokeColor={colors.primary}
        />
      </View>

      <View style={styles.sectionHeadRow}>
        <Text style={styles.sectionLabel}>30-DAY TRENDS</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nutrition Trends</Text>
        <Text style={styles.cardSubtitle}>
          Tap a metric to show / hide its line
        </Text>

        <View style={styles.legendRow}>
          {NUTRITION_SERIES.map(({ key, label, color }) => {
            const active = activeNutritionKeys.has(key);
            return (
              <Pressable
                key={key}
                onPress={() =>
                  setActiveNutritionKeys((prev) => {
                    const next = new Set(prev);
                    if (next.has(key)) {
                      if (next.size > 1) next.delete(key);
                    } else {
                      next.add(key);
                    }
                    return next;
                  })
                }
                style={[
                  styles.legendChip,
                  active
                    ? { borderColor: color, backgroundColor: `${color}22` }
                    : styles.legendChipInactive,
                ]}
              >
                <View
                  style={[
                    styles.legendDot,
                    {
                      backgroundColor: active
                        ? color
                        : "rgba(255,255,255,0.18)",
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.legendText,
                    active ? { color: color } : styles.legendTextInactive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.chartWrap}>
          <ColumnChart
            width={chartWidth}
            height={300}
            data={dataset}
            series={NUTRITION_SERIES.filter(({ key }) =>
              activeNutritionKeys.has(key),
            ).map((s) => ({
              key: s.key,
              color: s.color,
            }))}
          />
        </View>
      </View>

      <View style={styles.insightCard}>
        <View style={styles.insightIconBox}>
          <MaterialCommunityIcons
            color={colors.primary}
            name="flash"
            size={20}
          />
        </View>
        <View style={styles.insightTextWrap}>
          <Text style={styles.insightTitle}>Peak Performance Detected</Text>
          <Text style={styles.insightBody}>
            Protein intake is consistent. Recovery scores are higher than
            average this week.
          </Text>
        </View>
      </View>

      <Modal
        visible={isCalendarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCalendarOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModal}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>
                {calendarStep === "year"
                  ? "Select a Year"
                  : `Year ${selectedYear}`}
              </Text>
              <Pressable onPress={() => setIsCalendarOpen(false)}>
                <MaterialCommunityIcons
                  color={colors.textPrimary}
                  name="close"
                  size={20}
                />
              </Pressable>
            </View>

            <View style={styles.calendarStepRow}>
              <Pressable
                onPress={() => setCalendarStep("year")}
                style={[
                  styles.stepBtn,
                  calendarStep === "year" ? styles.stepBtnActive : undefined,
                ]}
              >
                <Text style={styles.stepBtnText}>Year</Text>
              </Pressable>
              <Pressable
                disabled={calendarStep === "year"}
                onPress={() => setCalendarStep("month")}
                style={[
                  styles.stepBtn,
                  calendarStep === "month" ? styles.stepBtnActive : undefined,
                ]}
              >
                <Text style={styles.stepBtnText}>Month</Text>
              </Pressable>
            </View>

            {calendarStep === "year" ? (
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
                        setCalendarStep("month");
                      }}
                      style={[
                        styles.yearCell,
                        active ? styles.yearCellActive : undefined,
                      ]}
                    >
                      <Text
                        style={[
                          styles.yearText,
                          active ? styles.yearTextActive : undefined,
                        ]}
                      >
                        {year}
                      </Text>
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
                      style={[
                        styles.monthCell,
                        active ? styles.monthCellActive : undefined,
                      ]}
                    >
                      <Text
                        style={[
                          styles.monthText,
                          active ? styles.monthTextActive : undefined,
                        ]}
                      >
                        {format(monthDate, "MMM")}
                      </Text>
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
    paddingTop: 12,
    paddingBottom: 24,
    gap: 16,
    backgroundColor: "#050505",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.2)",
    backgroundColor: "rgba(15,17,21,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifyDot: {
    position: "absolute",
    top: 7,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  sectionDate: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 10,
    fontWeight: "600",
  },
  periodWrap: {
    maxWidth: 220,
  },
  periodBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.2)",
    backgroundColor: "rgba(15,17,21,0.65)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  periodLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.6,
  },
  periodValuesRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  periodMonth: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: "600",
  },
  periodYear: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: "800",
  },
  progressGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 20,
  },
  progressWrap: {
    width: "48%",
    alignItems: "center",
  },
  progressSvgWrap: {
    position: "relative",
    width: 132,
    height: 132,
  },
  progressCenter: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  progressValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
  },
  progressUnit: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "600",
  },
  progressPct: {
    color: colors.textDim,
    fontSize: 10,
  },
  progressLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.8,
    marginTop: 8,
  },
  progressSubLabel: {
    color: colors.textDim,
    fontSize: 9,
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabBtnInactive: {
    backgroundColor: "rgba(15,17,21,0.65)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textDim,
  },
  tabTextActive: {
    color: "#ffffff",
  },
  card: {
    borderRadius: 20,
    backgroundColor: "rgba(15,17,21,0.65)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.15)",
    padding: 14,
    gap: 8,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  cardSubtitle: {
    color: colors.textDim,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  chartWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
    marginTop: 6,
    backgroundColor: "#0b1220",
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  legendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  legendChipInactive: {
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  systemStatus: {
    color: colors.primary,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.8,
    fontWeight: "800",
    marginBottom: 3,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "700",
  },
  legendTextInactive: {
    color: "rgba(255,255,255,0.25)",
  },
  insightCard: {
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.2)",
    backgroundColor: "rgba(15,17,21,0.65)",
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  insightIconBox: {
    backgroundColor: "rgba(59,130,246,0.18)",
    borderRadius: 10,
    padding: 8,
  },
  insightTextWrap: {
    flex: 1,
    gap: 2,
  },
  insightTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  insightBody: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    lineHeight: 17,
  },
  loadingOverlay: {
    paddingVertical: 4,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 13,
  },
  dateText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  calendarModal: {
    width: "100%",
    maxWidth: 420,
    maxHeight: 500,
    borderRadius: 18,
    backgroundColor: "#0b0f17",
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 14,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calendarTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  calendarStepRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    marginBottom: 10,
  },
  stepBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#374151",
    backgroundColor: "transparent",
  },
  stepBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  yearList: {
    maxHeight: 360,
  },
  yearGrid: {
    gap: 8,
  },
  yearCell: {
    width: "23%",
    marginHorizontal: "1%",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
    paddingVertical: 9,
    marginBottom: 8,
    alignItems: "center",
  },
  yearCellActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  yearText: {
    color: colors.textDim,
    fontWeight: "700",
  },
  yearTextActive: {
    color: "#fff",
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  monthCell: {
    width: "31%",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
    paddingVertical: 12,
    alignItems: "center",
  },
  monthCellActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  monthText: {
    color: colors.textDim,
    fontWeight: "700",
  },
  monthTextActive: {
    color: "#fff",
  },
});
