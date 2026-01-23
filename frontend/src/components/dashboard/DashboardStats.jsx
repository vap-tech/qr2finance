import React from "react";
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
  const formattedMonth = formatMonth(stats.month);
  const totalAmount = stats.total_sum_rub || 35;
  const cashAmount = stats.cash_sum_rub || 0;
  const cardAmount = stats.ecash_sum_rub || 0;

  const cashPercentage = calculatePercentages(totalAmount, cashAmount);
  const cardPercentage = calculatePercentages(totalAmount, cardAmount);

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
          label="Чеков всего"
          value={stats.receipts_count || 0}
          helpText="Количество чеков"
        />

        <StatCard
          icon={FaMoneyBillWave}
          iconColor="brand.500"
          label="Общие расходы"
          value={`${totalAmount.toFixed(2)} ₽`}
          helpText={`На ${formattedMonth}`}
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
