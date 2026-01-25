import React from "react";
import { useTotalSums } from "../../hooks/useTotalSums";
import PropTypes from "prop-types";
import { SimpleGrid, Box, HStack, Icon, Text } from "@chakra-ui/react";
import {
  FaCalendarAlt,
  FaReceipt,
  FaMoneyBillWave,
  FaCreditCard,
} from "react-icons/fa";
import StatCard from "./StatCard";
import { formatMonth, calculatePercentages } from "../../utils/format";

const DashboardStats = ({ stats }) => {
  const totalSums = useTotalSums();
  const formattedMonth = formatMonth(stats.month);

  // Используем данные из useTotalSums для процентов
  const totalAmount = totalSums.total_sum_rub || stats.total_sum_rub || 0;
  const cashAmount = totalSums.cash_sum_rub || stats.cash_sum_rub || 0;
  const cardAmount = totalSums.ecash_sum_rub || stats.ecash_sum_rub || 0;

  const cashPercentage =
    totalSums.percentages.cash ||
    (totalAmount > 0 ? (cashAmount / totalAmount) * 100 : 0);
  const cardPercentage =
    totalSums.percentages.ecash ||
    (totalAmount > 0 ? (cardAmount / totalAmount) * 100 : 0);

  return (
    <>
      <Box mb={4}>
        <HStack>
          <Icon as={FaCalendarAlt} color="brand.500" />
          <Text fontWeight="medium">Статистика за {formattedMonth}</Text>
        </HStack>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={8}>
        <StatCard
          icon={FaReceipt}
          iconColor="brand.500"
          label="Всего чеков"
          value={totalSums.receipts_count || stats.receipts_count || 0}
          helpText="За всё время"
        />

        <StatCard
          icon={FaMoneyBillWave}
          iconColor="brand.500"
          label="Общие расходы"
          value={`${totalAmount.toFixed(2)} ₽`}
          helpText="За всё время"
        />

        <StatCard
          icon={FaMoneyBillWave}
          iconColor="green.500"
          label="Наличные"
          value={`${cashAmount.toFixed(2)} ₽`}
          helpText={`${cashPercentage.toFixed(1)}% от общих`}
          showProgress
          progressValue={cashPercentage}
          progressColor="green"
        />

        <StatCard
          icon={FaCreditCard}
          iconColor="blue.500"
          label="Безналичные"
          value={`${cardAmount.toFixed(2)} ₽`}
          helpText={`${cardPercentage.toFixed(1)}% от общих`}
          showProgress
          progressValue={cardPercentage}
          progressColor="blue"
        />
      </SimpleGrid>
    </>
  );
};

DashboardStats.propTypes = {
  stats: PropTypes.shape({
    receipts_count: PropTypes.number,
    total_sum_rub: PropTypes.number,
    cash_sum_rub: PropTypes.number,
    ecash_sum_rub: PropTypes.number,
    month: PropTypes.string,
  }).isRequired,
};

export default DashboardStats;
