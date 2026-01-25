import React from "react";
import {
  Box,
  Heading,
  SimpleGrid,
  Select,
  HStack,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import MonthlyChart from "./MonthlyChart";
import ProductsChart from "./ProductsChart";
import InsightsPanel from "./InsightsPanel";

const AnalyticsContent = ({
  monthly,
  topProducts,
  year,
  monthsRange,
  setYear,
  setMonthsRange,
  getInsights,
}) => {
  // Все хуки гарантированно вызываются при каждом рендере
  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear, currentYear - 1, currentYear - 2];

  const selectBg = useColorModeValue("white", "gray.700");
  const boxBg = useColorModeValue("gray.50", "gray.800");

  const insights = getInsights();
  const totalAmount = monthly.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalReceipts = monthly.reduce(
    (sum, item) => sum + item.receiptsCount,
    0,
  );
  const totalCash = monthly.reduce(
    (sum, item) => sum + (item.cashAmount || 0),
    0,
  );
  const totalEcash = monthly.reduce(
    (sum, item) => sum + (item.ecashAmount || 0),
    0,
  );

  return (
    <Box mb={6}>
      <Heading mb={4}>Аналитика</Heading>

      <HStack justifyContent="space-between" wrap="wrap" spacing={4} mb={6}>
        <Box>
          <Text fontSize="sm" color="gray.600" mb={2}>
            Выберите период для анализа:
          </Text>
          <HStack spacing={4}>
            <Select
              width="150px"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              bg={selectBg}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y} год
                </option>
              ))}
            </Select>

            <Select
              width="200px"
              value={monthsRange}
              onChange={(e) => setMonthsRange(parseInt(e.target.value))}
              bg={selectBg}
            >
              <option value={3}>3 месяца</option>
              <option value={6}>6 месяцев</option>
              <option value={12}>Год</option>
            </Select>
          </HStack>
        </Box>

        <Box textAlign="right">
          <Text fontSize="sm" color="gray.600">
            Данных за {year} год
          </Text>
          <Text fontSize="lg" fontWeight="bold">
            {monthly.length} месяцев
          </Text>
        </Box>
      </HStack>

      {/* Панель инсайтов */}
      <Box mb={8}>
        <Text fontSize="lg" fontWeight="medium" mb={4}>
          Основные инсайты
        </Text>
        <InsightsPanel insights={insights} monthlyData={monthly} />
      </Box>

      {/* Графики */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} mb={6}>
        <MonthlyChart data={monthly} year={year} />
        <ProductsChart products={topProducts} />
      </SimpleGrid>

      {/* Сводная статистика */}
      <Box p={4} bg={boxBg} borderRadius="lg">
        <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
          <Box textAlign="center">
            <Text fontSize="sm" color="gray.600">
              Всего месяцев
            </Text>
            <Text fontSize="2xl" fontWeight="bold">
              {monthly.length}
            </Text>
          </Box>
          <Box textAlign="center">
            <Text fontSize="sm" color="gray.600">
              Общая сумма
            </Text>
            <Text fontSize="2xl" fontWeight="bold">
              {totalAmount.toFixed(2)} ₽
            </Text>
          </Box>
          <Box textAlign="center">
            <Text fontSize="sm" color="gray.600">
              Всего чеков
            </Text>
            <Text fontSize="2xl" fontWeight="bold">
              {totalReceipts}
            </Text>
          </Box>
          <Box textAlign="center">
            <Text fontSize="sm" color="gray.600">
              Средний чек
            </Text>
            <Text fontSize="2xl" fontWeight="bold">
              {totalReceipts > 0 ? (totalAmount / totalReceipts).toFixed(2) : 0}{" "}
              ₽
            </Text>
          </Box>
        </SimpleGrid>

        {totalAmount > 0 && (
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mt={4}>
            <Box textAlign="center">
              <Text fontSize="sm" color="gray.600">
                Наличные ({((totalCash / totalAmount) * 100).toFixed(1)}%)
              </Text>
              <Text fontSize="lg" fontWeight="bold" color="green.600">
                {totalCash.toFixed(2)} ₽
              </Text>
            </Box>
            <Box textAlign="center">
              <Text fontSize="sm" color="gray.600">
                Безналичные ({((totalEcash / totalAmount) * 100).toFixed(1)}%)
              </Text>
              <Text fontSize="lg" fontWeight="bold" color="blue.600">
                {totalEcash.toFixed(2)} ₽
              </Text>
            </Box>
          </SimpleGrid>
        )}
      </Box>
    </Box>
  );
};

export default AnalyticsContent;
