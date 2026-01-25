import React from "react";
import PropTypes from "prop-types";
import {
  SimpleGrid,
  Box,
  Text,
  VStack,
  HStack,
  Icon,
  Badge,
  Progress,
  useColorModeValue,
} from "@chakra-ui/react";
import {
  FaChartLine,
  FaShoppingCart,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaCreditCard,
  FaReceipt,
} from "react-icons/fa";

const InsightsPanel = ({ insights, monthlyData = [] }) => {
  const getIcon = (type) => {
    switch (type) {
      case "max":
        return FaMoneyBillWave;
      case "activity":
        return FaCalendarAlt;
      case "product":
        return FaShoppingCart;
      case "cash":
        return FaMoneyBillWave;
      case "ecash":
        return FaCreditCard;
      case "receipts":
        return FaReceipt;
      default:
        return FaChartLine;
    }
  };

  const getColor = (type) => {
    switch (type) {
      case "max":
        return "red";
      case "activity":
        return "blue";
      case "product":
        return "green";
      case "cash":
        return "green";
      case "ecash":
        return "blue";
      case "receipts":
        return "purple";
      default:
        return "purple";
    }
  };

  // Добавим инсайты по платежам если есть данные
  const allInsights = [...insights];

  if (monthlyData.length > 0) {
    const currentMonth = monthlyData[0];
    const total = currentMonth.totalAmount || 0;
    const cash = currentMonth.cashAmount || 0;
    const ecash = currentMonth.ecashAmount || 0;
    const receipts = currentMonth.receiptsCount || 0;

    if (total > 0) {
      allInsights.push({
        type: "cash",
        title: "Наличные",
        value: `${((cash / total) * 100).toFixed(1)}%`,
        amount: cash,
      });

      allInsights.push({
        type: "ecash",
        title: "Безналичные",
        value: `${((ecash / total) * 100).toFixed(1)}%`,
        amount: ecash,
      });

      if (receipts > 0) {
        allInsights.push({
          type: "receipts",
          title: "Средний чек",
          value: `${(total / receipts).toFixed(2)} ₽`,
          count: receipts,
        });
      }
    }
  }

  if (allInsights.length === 0) {
    return (
      <Box textAlign="center" py={8} color="gray.500">
        <Text>Нет данных для аналитики</Text>
      </Box>
    );
  }

  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
      {allInsights.map((insight, index) => (
        <Box
          key={index}
          p={4}
          bg={useColorModeValue("white", "gray.800")}
          borderRadius="lg"
          shadow="sm"
          borderLeft="4px solid"
          borderColor={`${getColor(insight.type)}.400`}
        >
          <VStack align="start" spacing={2}>
            <HStack>
              <Icon
                as={getIcon(insight.type)}
                color={`${getColor(insight.type)}.500`}
              />
              <Text fontSize="sm" fontWeight="medium" color="gray.600">
                {insight.title}
              </Text>
            </HStack>

            <Text fontSize="lg" fontWeight="bold">
              {insight.value}
            </Text>

            {insight.amount !== undefined && (
              <Badge colorScheme={getColor(insight.type)} fontSize="sm">
                {insight.amount.toFixed(2)} ₽
              </Badge>
            )}

            {insight.count !== undefined && (
              <Text fontSize="sm" color="gray.500">
                {insight.count} чеков
              </Text>
            )}

            {/* Прогресс бар для процентов */}
            {insight.type === "cash" || insight.type === "ecash" ? (
              <Progress
                value={parseFloat(insight.value)}
                colorScheme={getColor(insight.type)}
                size="sm"
                width="100%"
                borderRadius="full"
              />
            ) : null}
          </VStack>
        </Box>
      ))}
    </SimpleGrid>
  );
};

InsightsPanel.propTypes = {
  insights: PropTypes.array.isRequired,
  monthlyData: PropTypes.array,
};

export default InsightsPanel;
