import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  GridItem,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Card,
  CardBody,
  Heading,
  SimpleGrid,
  useColorModeValue,
  Text,
  Badge,
  Progress,
  HStack,
  Icon,
  VStack,
  Tag,
} from "@chakra-ui/react";
import {
  FaReceipt,
  FaStore,
  FaMoneyBillWave,
  FaCreditCard,
  FaCalendarAlt,
} from "react-icons/fa";
import { analyticsAPI, receiptsAPI } from "../services/api";
import Layout from "./Layout";
import LoadingSpinner from "./LoadingSpinner";
import { format } from "date-fns";

const Dashboard = () => {
  const [stats, setStats] = useState({
    receipts_count: 0,
    total_sum_rub: 0,
    cash_sum_rub: 0,
    ecash_sum_rub: 0,
    month: new Date().toISOString().slice(0, 7), // формат YYYY-MM
  });
  const [recentReceipts, setRecentReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Функция для конвертации копеек в рубли
  const kopecksToRubles = (kopecks) => {
    if (kopecks === null || kopecks === undefined) return 0;
    return Number(kopecks) / 100;
  };

  // Функция для безопасного получения месяца из статистики
  const getFormattedMonth = (monthData) => {
    if (!monthData) {
      const now = new Date();
      return `${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
    }

    if (typeof monthData === "string") {
      // Если месяц в формате YYYY-MM
      if (monthData.includes("-")) {
        const [year, month] = monthData.split("-");
        return `${month}.${year}`;
      }
      return monthData;
    }

    // Если месяц - это объект или число
    return "текущий месяц";
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Пытаемся получить статистику за месяц и последние чеки
      const [monthlyStatsRes, receiptsRes] = await Promise.all([
        analyticsAPI.getMonthlyDynamics().catch(() => ({ data: null })),
        receiptsAPI.getReceipts(0, 50).catch(() => ({ data: [] })),
      ]);

      const monthlyStats = monthlyStatsRes?.data || {};
      const receipts = receiptsRes?.data || [];

      console.log("Monthly stats:", monthlyStats);
      console.log("Recent receipts:", receipts);

      // Обрабатываем статистику
      let processedStats = {
        receipts_count: 0,
        total_sum_rub: 0,
        cash_sum_rub: 0,
        ecash_sum_rub: 0,
        month: new Date().toISOString().slice(0, 7),
      };

      if (monthlyStats && typeof monthlyStats === "object") {
        // Обрабатываем разные форматы ответа API
        const totalSum = monthlyStats.total_sum || 0;
        const cashSum = monthlyStats.cash_total_sum || 0;
        const ecashSum = monthlyStats.ecash_total_sum || 0;
        const receiptsCount = monthlyStats.receipts_count || 0;

        processedStats = {
          receipts_count: receiptsCount,
          total_sum: totalSum,
          total_sum_rub: kopecksToRubles(totalSum),
          cash_sum: cashSum,
          cash_sum_rub: kopecksToRubles(cashSum),
          ecash_sum: ecashSum,
          ecash_sum_rub: kopecksToRubles(ecashSum),
          month:
            monthlyStats.month ||
            monthlyStats.date ||
            new Date().toISOString().slice(0, 7),
        };
      }

      setStats(processedStats);

      // Обрабатываем чеки
      const formattedReceipts = Array.isArray(receipts)
        ? receipts.map((receipt) => ({
            ...receipt,
            // Конвертируем суммы в рубли
            total_sum_rub: kopecksToRubles(receipt.total_sum || 0),
            shop_name: receipt.shop?.retail_name || "Неизвестный магазин",
            shop_chain: receipt.shop?.legal_name || "",
            cashier_name: receipt.cashier?.name || "",
            items_count: receipt.items?.length || 0,
            date_time: receipt.date_time || new Date().toISOString(),
            id: receipt.id || receipt.external_id || Math.random().toString(),
          }))
        : [];

      setRecentReceipts(formattedReceipts);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      // Устанавливаем значения по умолчанию при ошибке
      setStats({
        receipts_count: 0,
        total_sum_rub: 0,
        cash_sum_rub: 0,
        ecash_sum_rub: 0,
        month: new Date().toISOString().slice(0, 7),
      });
      setRecentReceipts([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner text="Загрузка дашборда..." />
      </Layout>
    );
  }

  // Убедимся, что значения - это числа
  const totalAmount = Number(stats.total_sum_rub) || 0;
  const cashAmount = Number(stats.cash_sum_rub) || 0;
  const cardAmount = Number(stats.ecash_sum_rub) || 0;
  const cashPercentage = totalAmount > 0 ? (cashAmount / totalAmount) * 100 : 0;
  const cardPercentage = totalAmount > 0 ? (cardAmount / totalAmount) * 100 : 0;

  // Получаем уникальные магазины
  const uniqueStores = new Set(
    recentReceipts
      .map((r) => r.shop_name)
      .filter((name) => name && name !== "Неизвестный магазин"),
  ).size;

  // Форматируем месяц для отображения
  const formattedMonth = getFormattedMonth(stats.month);

  return (
    <Layout>
      <Heading mb={6} size="xl">
        📊 Дашборд
      </Heading>

      <Box mb={4}>
        <HStack>
          <Icon as={FaCalendarAlt} color="brand.500" />
          <Text fontWeight="medium">Статистика за {formattedMonth}</Text>
        </HStack>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={8}>
        <Card bg={useColorModeValue("white", "gray.800")} shadow="sm">
          <CardBody>
            <Stat>
              <HStack>
                <Icon as={FaReceipt} color="brand.500" boxSize={6} />
                <StatLabel>Чеков за месяц</StatLabel>
              </HStack>
              <StatNumber>{stats.receipts_count || 0}</StatNumber>
              <StatHelpText>Последние 30 дней</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg={useColorModeValue("white", "gray.800")} shadow="sm">
          <CardBody>
            <Stat>
              <HStack>
                <Icon as={FaMoneyBillWave} color="brand.500" boxSize={6} />
                <StatLabel>Общие расходы</StatLabel>
              </HStack>
              <StatNumber>{totalAmount.toFixed(2)} ₽</StatNumber>
              <StatHelpText>За {formattedMonth}</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg={useColorModeValue("white", "gray.800")} shadow="sm">
          <CardBody>
            <Stat>
              <HStack>
                <Icon as={FaMoneyBillWave} color="green.500" boxSize={6} />
                <StatLabel>Наличные</StatLabel>
              </HStack>
              <StatNumber>{cashAmount.toFixed(2)} ₽</StatNumber>
              <StatHelpText>
                {totalAmount > 0 ? cashPercentage.toFixed(1) : 0}% от общих
              </StatHelpText>
              <Progress
                value={cashPercentage}
                colorScheme="green"
                size="sm"
                mt={2}
              />
            </Stat>
          </CardBody>
        </Card>

        <Card bg={useColorModeValue("white", "gray.800")} shadow="sm">
          <CardBody>
            <Stat>
              <HStack>
                <Icon as={FaCreditCard} color="blue.500" boxSize={6} />
                <StatLabel>Безналичные</StatLabel>
              </HStack>
              <StatNumber>{cardAmount.toFixed(2)} ₽</StatNumber>
              <StatHelpText>
                {totalAmount > 0 ? cardPercentage.toFixed(1) : 0}% от общих
              </StatHelpText>
              <Progress
                value={cardPercentage}
                colorScheme="blue"
                size="sm"
                mt={2}
              />
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      <Grid templateColumns={{ base: "1fr", lg: "2fr 1fr" }} gap={6}>
        <GridItem>
          <Card bg={useColorModeValue("white", "gray.800")} shadow="sm">
            <CardBody>
              <Heading
                size="md"
                mb={4}
                display="flex"
                alignItems="center"
                gap={2}
              >
                <Icon as={FaReceipt} /> Последние чеки
              </Heading>
              {recentReceipts.length > 0 ? (
                <VStack align="stretch" spacing={3}>
                  {recentReceipts.slice(0, 10).map((receipt) => (
                    <Box
                      key={receipt.id}
                      p={4}
                      bg={useColorModeValue("gray.50", "gray.700")}
                      borderRadius="lg"
                      borderLeft="4px solid"
                      borderColor="brand.500"
                      _hover={{
                        bg: useColorModeValue("gray.100", "gray.600"),
                        transform: "translateY(-2px)",
                        transition: "all 0.2s",
                      }}
                    >
                      <HStack justifyContent="space-between" mb={2}>
                        <Text fontWeight="bold" fontSize="lg">
                          {receipt.total_sum_rub.toFixed(2)} ₽
                        </Text>
                        <Badge
                          colorScheme={
                            receipt.cash_total_sum > 0 ? "green" : "blue"
                          }
                        >
                          {receipt.cash_total_sum > 0 ? "НАЛИЧНЫЕ" : "КАРТА"}
                        </Badge>
                      </HStack>
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="medium">{receipt.shop_name}</Text>
                        {receipt.shop_chain && (
                          <Tag size="sm" colorScheme="blue">
                            {receipt.shop_chain}
                          </Tag>
                        )}
                        {receipt.cashier_name && (
                          <Text fontSize="xs" color="gray.600">
                            Кассир: {receipt.cashier_name}
                          </Text>
                        )}
                        <Text fontSize="xs" color="gray.500">
                          {receipt.date_time
                            ? format(
                                new Date(receipt.date_time),
                                "dd.MM.yyyy HH:mm",
                              )
                            : "Нет даты"}{" "}
                          • {receipt.items_count} товаров
                        </Text>
                      </VStack>
                    </Box>
                  ))}
                </VStack>
              ) : (
                <Box textAlign="center" py={8}>
                  <Text color="gray.500">Пока нет чеков</Text>
                  <Text fontSize="sm" color="gray.400" mt={2}>
                    Загрузите первый чек в разделе "Чеки"
                  </Text>
                </Box>
              )}
            </CardBody>
          </Card>
        </GridItem>

        <GridItem>
          <Card bg={useColorModeValue("white", "gray.800")} shadow="sm">
            <CardBody>
              <Heading
                size="md"
                mb={4}
                display="flex"
                alignItems="center"
                gap={2}
              >
                <Icon as={FaStore} /> Статистика по магазинам
              </Heading>

              <Box mb={6}>
                <VStack align="stretch" spacing={3}>
                  <Box>
                    <Text fontSize="sm" fontWeight="medium" mb={2}>
                      Всего чеков
                    </Text>
                    <HStack>
                      <Text fontSize="2xl" fontWeight="bold">
                        {recentReceipts.length}
                      </Text>
                      <Text fontSize="sm" color="gray.500">
                        за всё время
                      </Text>
                    </HStack>
                    <Progress
                      value={Math.min(recentReceipts.length * 2, 100)}
                      colorScheme="brand"
                      size="sm"
                      borderRadius="full"
                      mt={2}
                    />
                  </Box>

                  <Box>
                    <Text fontSize="sm" fontWeight="medium" mb={2}>
                      Уникальных магазинов
                    </Text>
                    <HStack>
                      <Text fontSize="2xl" fontWeight="bold">
                        {uniqueStores}
                      </Text>
                      <Text fontSize="sm" color="gray.500">
                        посещено
                      </Text>
                    </HStack>
                    <Progress
                      value={Math.min(uniqueStores * 20, 100)}
                      colorScheme="green"
                      size="sm"
                      borderRadius="full"
                      mt={2}
                    />
                  </Box>

                  {stats.receipts_count > 0 && totalAmount > 0 && (
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={2}>
                        Средний чек ({formattedMonth})
                      </Text>
                      <Text fontSize="2xl" fontWeight="bold">
                        {(totalAmount / stats.receipts_count).toFixed(2)} ₽
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        за текущий месяц
                      </Text>
                    </Box>
                  )}
                </VStack>
              </Box>

              {recentReceipts.length > 0 && (
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={3}>
                    Топ магазины по тратам
                  </Text>
                  <VStack align="stretch" spacing={2}>
                    {Object.entries(
                      recentReceipts.reduce((acc, receipt) => {
                        const store = receipt.shop_name;
                        if (!acc[store]) acc[store] = 0;
                        acc[store] += receipt.total_sum_rub;
                        return acc;
                      }, {}),
                    )
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([store, amount], index) => (
                        <HStack
                          key={store}
                          justifyContent="space-between"
                          p={2}
                          bg={useColorModeValue("gray.50", "gray.700")}
                          borderRadius="md"
                        >
                          <HStack spacing={2}>
                            <Text
                              fontWeight="bold"
                              fontSize="sm"
                              minWidth="20px"
                            >
                              {index + 1}.
                            </Text>
                            <Text fontSize="sm" isTruncated maxW="150px">
                              {store}
                            </Text>
                          </HStack>
                          <Text fontWeight="medium" fontSize="sm">
                            {amount.toFixed(2)} ₽
                          </Text>
                        </HStack>
                      ))}
                  </VStack>
                </Box>
              )}
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    </Layout>
  );
};

export default Dashboard;
