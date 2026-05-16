import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { colors } from "@/theme/tokens";

interface PeriodWheelPickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (year: number, month: number) => void;
  defaultYear?: number;
  defaultMonth?: number;
}

const WHEEL_ITEM_HEIGHT = 50;
const VISIBLE_ITEMS = 5;
const ITEM_SIZE = WHEEL_ITEM_HEIGHT;

export function PeriodWheelPicker({
  visible,
  onClose,
  onConfirm,
  defaultYear = new Date().getFullYear(),
  defaultMonth = new Date().getMonth(),
}: PeriodWheelPickerProps) {
  const [step, setStep] = useState<"year" | "month">("year");
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [tempYear, setTempYear] = useState(defaultYear);
  const [tempMonth, setTempMonth] = useState(defaultMonth);

  const scrollViewRef = useRef<ScrollView>(null);
  const monthScrollViewRef = useRef<ScrollView>(null);
  const hasScrolledRef = useRef(false);

  // Generate years (2010 to 2100)
  const years = useRef(
    (() => {
      const yearArray = [];
      for (let i = 2010; i <= 2100; i++) {
        yearArray.push(i);
      }
      return yearArray;
    })()
  ).current;

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const PADDING = ((VISIBLE_ITEMS - 1) / 2) * ITEM_SIZE;

  // Scroll to selected item only on step change (not on every state update)
  useEffect(() => {
    if (step === "year" && visible && !hasScrolledRef.current) {
      const index = years.indexOf(tempYear);
      if (index !== -1) {
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            y: index * ITEM_SIZE,
            animated: false,
          });
          hasScrolledRef.current = true;
        }, 50);
      }
    }
  }, [step, visible]);

  useEffect(() => {
    if (step === "month" && visible && !hasScrolledRef.current) {
      const index = tempMonth;
      setTimeout(() => {
        monthScrollViewRef.current?.scrollTo({
          y: index * ITEM_SIZE,
          animated: false,
        });
        hasScrolledRef.current = true;
      }, 50);
    }
  }, [step, visible]);

  const handleYearScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / ITEM_SIZE);
      const snappedIndex = Math.max(0, Math.min(index, years.length - 1));
      if (years[snappedIndex] !== tempYear) {
        setTempYear(years[snappedIndex]);
      }
    },
    [years, tempYear]
  );

  const handleMonthScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / ITEM_SIZE);
      const snappedIndex = Math.max(0, Math.min(index, 11));
      if (snappedIndex !== tempMonth) {
        setTempMonth(snappedIndex);
      }
    },
    [tempMonth]
  );

  const handleYearMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / ITEM_SIZE);
      const snappedIndex = Math.max(0, Math.min(index, years.length - 1));
      setTempYear(years[snappedIndex]);
    },
    [years]
  );

  const handleMonthMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / ITEM_SIZE);
      const snappedIndex = Math.max(0, Math.min(index, 11));
      setTempMonth(snappedIndex);
    },
    []
  );

  const handleYearConfirm = () => {
    setSelectedYear(tempYear);
    hasScrolledRef.current = false; // Reset so month picker scrolls on mount
    setStep("month");
  };

  const handleMonthConfirm = () => {
    setSelectedMonth(tempMonth);
    onConfirm(tempYear, tempMonth);
    // Reset for next time
    setStep("year");
    setTempYear(defaultYear);
    setTempMonth(defaultMonth);
  };

  const handleBack = () => {
    setStep("year");
    setTempMonth(defaultMonth);
  };

  const handleClose = () => {
    setStep("year");
    setTempYear(defaultYear);
    setTempMonth(defaultMonth);
    hasScrolledRef.current = false;
    onClose();
  };

  if (!visible) return null;

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        {/* Animated background */}
        <Pressable style={styles.backdrop} onPress={handleClose} />

        {/* Bottom Sheet Modal */}
        <View style={styles.bottomSheet}>
          {/* Action Bar */}
          <View style={styles.actionBar}>
            <Pressable
              onPress={step === "year" ? handleClose : handleBack}
              hitSlop={8}
            >
              <Text style={styles.actionBtnText}>
                {step === "year" ? "Cancel" : "Back"}
              </Text>
            </Pressable>

            <Text style={styles.modalTitle}>
              {step === "year" ? "Select Year" : "Select Month"}
            </Text>

            <Pressable
              onPress={step === "year" ? handleYearConfirm : handleMonthConfirm}
              hitSlop={8}
            >
              <Text style={styles.actionBtnText}>
                {step === "year" ? "Next" : "Done"}
              </Text>
            </Pressable>
          </View>

          {/* Wheel Picker Container */}
          <View style={styles.wheelContainer}>

            {/* Year Picker */}
            {step === "year" && (
              <ScrollView
                ref={scrollViewRef}
                style={styles.wheelScroll}
                snapToInterval={ITEM_SIZE}
                decelerationRate="fast"
                scrollEventThrottle={16}
                onScroll={handleYearScroll}
                onMomentumScrollEnd={handleYearMomentumEnd}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  styles.wheelContent,
                  {
                    paddingTop: PADDING,
                    paddingBottom: PADDING,
                  },
                ]}
              >
                {years.map((year, index) => {
                  const isSelected = year === tempYear;
                  return (
                    <Pressable
                      key={index}
                      onPress={() => {
                        setTempYear(year);
                        const scrollY = index * ITEM_SIZE;
                        scrollViewRef.current?.scrollTo({
                          y: scrollY,
                          animated: true,
                        });
                      }}
                      style={[
                        styles.wheelItem,
                        { height: ITEM_SIZE },
                      ]}
                    >
                      <Text
                        style={[
                          styles.wheelText,
                          isSelected && styles.wheelTextSelected,
                        ]}
                      >
                        {year}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* Month Picker */}
            {step === "month" && (
              <ScrollView
                ref={monthScrollViewRef}
                style={styles.wheelScroll}
                snapToInterval={ITEM_SIZE}
                decelerationRate="fast"
                scrollEventThrottle={16}
                onScroll={handleMonthScroll}
                onMomentumScrollEnd={handleMonthMomentumEnd}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  styles.wheelContent,
                  {
                    paddingTop: PADDING,
                    paddingBottom: PADDING,
                  },
                ]}
              >
                {months.map((month, index) => {
                  const isSelected = index === tempMonth;
                  return (
                    <Pressable
                      key={index}
                      onPress={() => {
                        setTempMonth(index);
                        const scrollY = index * ITEM_SIZE;
                        monthScrollViewRef.current?.scrollTo({
                          y: scrollY,
                          animated: true,
                        });
                      }}
                      style={[
                        styles.wheelItem,
                        { height: ITEM_SIZE },
                      ]}
                    >
                      <Text
                        style={[
                          styles.wheelText,
                          isSelected && styles.wheelTextSelected,
                        ]}
                      >
                        {month}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Confirm Button */}
          <View style={styles.confirmButtonContainer}>
            <Pressable
              onPress={step === "year" ? handleYearConfirm : handleMonthConfirm}
              style={styles.confirmButton}
            >
              <Text style={styles.confirmButtonText}>
                {step === "year" ? "Next" : "Confirm"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  bottomSheet: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  actionBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
    minWidth: 50,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  wheelContainer: {
    height: VISIBLE_ITEMS * ITEM_SIZE,
    marginVertical: 16,
    position: "relative",
    justifyContent: "center",
  },
  selectionHighlight: {
    position: "absolute",
    top: "50%",
    left: "10%",
    right: "10%",
    height: ITEM_SIZE,
    marginTop: -ITEM_SIZE / 2,
    backgroundColor: "rgba(59, 130, 246, 0.06)",
    zIndex: 1,
  },
  wheelScroll: {
    flex: 1,
  },
  wheelContent: {
    alignItems: "center",
  },
  wheelItem: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  wheelText: {
    fontSize: 20,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.4)",
    letterSpacing: 0.3,
  },
  wheelTextSelected: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "700",
  },
  confirmButtonContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
