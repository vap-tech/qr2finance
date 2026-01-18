import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  SimpleGrid,
  Card,
  CardBody,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  Spinner,
  Select,
  HStack,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import Layout from './Layout';
import { analyticsAPI } from '../services/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

// Вспомогательная функция для конвертации Decimal
const safeToNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  if (typeof value === 'object') {
    if (value.str !== undefined) return parseFloat(value.str) || 0;
    if (value.__Decimal__ !== undefined) return parseFloat(value.str) || 0;
  }
  try {
    return parseFloat(value) || 0;
  } catch {
    return 0;
  }
};

// Вспомогательная функция для форматирования
const formatNumber = (value, decimals = 2) => {
  const num = safeToNumber(value);
  return num.toFixed(decimals);
};

// Функция для получения названия месяца по номеру
const getMonthName = (monthNumber) => {
  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];
  return months[monthNumber - 1] || `Месяц ${monthNumber}`;
};

const Analytics = () => {
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [storeStats, setStoreStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('6');
  const [year, setYear] = useState(new Date().getFullYear()); // Текущий год

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange, year]); // Добавили year в зависимости

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const [monthlyRes, productsRes, storesRes] = await Promise.all([
        analyticsAPI.getMonthlyStats(year), // Используем текущий год
        analyticsAPI.getTopProducts(parseInt(timeRange), 10),
        analyticsAPI.getStoreStats(),
      ]);

      console.log('Monthly stats response:', monthlyRes.data);
      console.log('Store stats response:', storesRes.data);
      console.log('Top products response:', productsRes.data);

      // 1. Конвертируем месячную динамику
      // Если бэкенд возвращает только сумму по месяцам, без количества чеков
      const formattedMonthlyStats = (monthlyRes.data || []).map(item => {
        // Проверяем, если есть поле receipts_count в данных
        const hasReceiptsCount = item.receipts_count !== undefined;

        return {
          month: item.month,
          displayMonth: getMonthName(item.month),
          total_sum_rub: safeToNumber(item.sum),
          // Добавляем информацию о наличии данных о количестве чеков
          hasReceiptsData: hasReceiptsCount,
          // Используем реальное количество чеков, если есть, иначе null
          receipts_count: hasReceiptsCount ? safeToNumber(item.receipts_count) : null,
        };
      });

      // 2. Конвертируем топ товаров
      const formattedTopProducts = (productsRes.data || []).map(product => ({
        ...product,
        name: product.name || 'Без названия',
        total_sum_rub: safeToNumber(product.total_sum),
        total_quantity: safeToNumber(product.total_quantity),
        measure: product.measure || 'шт',
      }));

      // 3. Конвертируем статистику магазинов
      const formattedStoreStats = (storesRes.data || []).map(store => ({
        ...store,
        retail_place: store.retail_name || 'Неизвестный магазин',
        total_sum_rub: safeToNumber(store.total_amount),
        receipts_count: store.receipts_count || 0,
        // Средний чек
        avg_receipt_sum_rub: store.receipts_count > 0
          ? safeToNumber(store.total_amount) / store.receipts_count
          : safeToNumber(store.total_amount),
      }));

      setMonthlyStats(formattedMonthlyStats);
      setTopProducts(formattedTopProducts);
      setStoreStats(formattedStoreStats);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setMonthlyStats([]);
      setTopProducts([]);
      setStoreStats([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <Box textAlign="center" py={10}>
          <Spinner size="xl" color="teal.500" />
        </Box>
      </Layout>
    );
  }

  // Проверяем, есть ли данные о количестве чеков в monthlyStats
  const hasReceiptsCountData = monthlyStats.some(item => item.receipts_count !== null);
  const totalReceiptsCount = storeStats.reduce((sum, store) => sum + (store.receipts_count || 0), 0);

  return (
    <Layout>
      <HStack justifyContent="space-between" mb={6} wrap="wrap" spacing={4}>
        <Heading>Аналитика</Heading>
        <HStack>
          <Select
            width="200px"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
          >
            <option value={2026}>2026 год</option>
            <option value={2025}>2025 год</option>
            <option value={2024}>2024 год</option>
          </Select>
          <Select
            width="200px"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="3">Последние 3 месяца</option>
            <option value="6">Последние 6 месяцев</option>
            <option value="12">Последний год</option>
          </Select>
        </HStack>
      </HStack>

      {/* Показать общую статистику */}
      {storeStats.length > 0 && (
        <Box mb={6} p={4} bg="teal.50" borderRadius="lg">
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <Box textAlign="center">
              <Text fontSize="sm" color="gray.600">Всего магазинов</Text>
              <Text fontSize="2xl" fontWeight="bold">{storeStats.length}</Text>
            </Box>
            <Box textAlign="center">
              <Text fontSize="sm" color="gray.600">Всего чеков</Text>
              <Text fontSize="2xl" fontWeight="bold">{totalReceiptsCount}</Text>
            </Box>
            <Box textAlign="center">
              <Text fontSize="sm" color="gray.600">Общая сумма</Text>
              <Text fontSize="2xl" fontWeight="bold">
                {formatNumber(storeStats.reduce((sum, store) => sum + (store.total_sum_rub || 0), 0), 2)} ₽
              </Text>
            </Box>
          </SimpleGrid>
        </Box>
      )}

      <Tabs colorScheme="teal">
        <TabList>
          <Tab>Обзор расходов</Tab>
          <Tab>Топ товаров</Tab>
          <Tab>Анализ магазинов</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <SimpleGrid columns={{ base: 1, lg: hasReceiptsCountData ? 2 : 1 }} spacing={6}>
              <Card>
                <CardBody>
                  <Heading size="sm" mb={4}>Ежемесячные расходы ({year} год)</Heading>
                  <Box height="300px">
                    {monthlyStats.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="month"
                            tickFormatter={(value) => getMonthName(value)}
                          />
                          <YAxis />
                          <Tooltip
                            formatter={(value) => [`${formatNumber(value, 2)} ₽`, 'Сумма']}
                            labelFormatter={(label) => getMonthName(label)}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="total_sum_rub"
                            stroke="#8884d8"
                            name="Сумма расходов"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                        <Text color="gray.500">Нет данных за выбранный период</Text>
                      </Box>
                    )}
                  </Box>
                </CardBody>
              </Card>

              {hasReceiptsCountData ? (
                <Card>
                  <CardBody>
                    <Heading size="sm" mb={4}>Количество чеков ({year} год)</Heading>
                    <Box height="300px">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyStats.filter(item => item.receipts_count !== null)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="month"
                            tickFormatter={(value) => getMonthName(value)}
                          />
                          <YAxis />
                          <Tooltip
                            formatter={(value) => [value, 'Количество чеков']}
                            labelFormatter={(label) => getMonthName(label)}
                          />
                          <Legend />
                          <Bar
                            dataKey="receipts_count"
                            fill="#82ca9d"
                            name="Количество чеков"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardBody>
                </Card>
              ) : (
                <Card>
                  <CardBody>
                    <Heading size="sm" mb={4}>Информация о количестве чеков</Heading>
                    <Alert status="info" borderRadius="md">
                      <AlertIcon />
                      <Box>
                        <Text fontWeight="medium">Данные о количестве чеков по месяцам отсутствуют</Text>
                        <Text fontSize="sm" mt={1}>
                          Общее количество чеков: <strong>{totalReceiptsCount}</strong>
                        </Text>
                        <Text fontSize="sm">
                          Общая сумма расходов: <strong>
                            {formatNumber(storeStats.reduce((sum, store) => sum + (store.total_sum_rub || 0), 0), 2)} ₽
                          </strong>
                        </Text>
                      </Box>
                    </Alert>
                  </CardBody>
                </Card>
              )}
            </SimpleGrid>
          </TabPanel>

          <TabPanel>
            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
              <Card>
                <CardBody>
                  <Heading size="sm" mb={4}>Топ 10 товаров по расходам</Heading>
                  <Box height="400px">
                    {topProducts.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={topProducts}
                          layout="vertical"
                          margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            type="number"
                            tickFormatter={(value) => `${formatNumber(value, 0)} ₽`}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={80}
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) =>
                              value.length > 20 ? `${value.substring(0, 20)}...` : value
                            }
                          />
                          <Tooltip
                            formatter={(value) => [`${formatNumber(value, 2)} ₽`, 'Сумма']}
                          />
                          <Bar
                            dataKey="total_sum_rub"
                            fill="#8884d8"
                            name="Потрачено"
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                        <Text color="gray.500">Нет данных о товарах</Text>
                      </Box>
                    )}
                  </Box>
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <Heading size="sm" mb={4}>Распределение расходов</Heading>
                  <Box height="400px">
                    {topProducts.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={topProducts}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => {
                              const productName = name.length > 15 ? `${name.substring(0, 15)}...` : name;
                              return `${productName}: ${(percent * 100).toFixed(0)}%`;
                            }}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="total_sum_rub"
                          >
                            {topProducts.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => [`${formatNumber(value, 2)} ₽`, 'Сумма']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                        <Text color="gray.500">Нет данных для круговой диаграммы</Text>
                      </Box>
                    )}
                  </Box>
                </CardBody>
              </Card>
            </SimpleGrid>

            {topProducts.length > 0 && (
              <Card mt={6}>
                <CardBody>
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Товар</Th>
                        <Th isNumeric>Количество</Th>
                        <Th isNumeric>Потрачено</Th>
                        <Th>Единица измерения</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {topProducts.map((product, index) => (
                        <Tr key={`${product.name}-${index}`}>
                          <Td maxWidth="300px" overflow="hidden" textOverflow="ellipsis">
                            {product.name}
                          </Td>
                          <Td isNumeric>{formatNumber(product.total_quantity, 2)}</Td>
                          <Td isNumeric>{formatNumber(product.total_sum_rub, 2)} ₽</Td>
                          <Td>{product.measure}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </CardBody>
              </Card>
            )}
          </TabPanel>

          <TabPanel>
            <Card>
              <CardBody>
                <Heading size="sm" mb={4}>Статистика по магазинам</Heading>
                {storeStats.length > 0 ? (
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Магазин</Th>
                        <Th isNumeric>Чеков</Th>
                        <Th isNumeric>Потрачено</Th>
                        <Th isNumeric>Ср. чек</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {storeStats.map((store, index) => (
                        <Tr key={`${store.retail_place}-${index}`}>
                          <Td maxWidth="250px" overflow="hidden" textOverflow="ellipsis">
                            {store.retail_place}
                          </Td>
                          <Td isNumeric>{store.receipts_count}</Td>
                          <Td isNumeric>{formatNumber(store.total_sum_rub, 2)} ₽</Td>
                          <Td isNumeric>{formatNumber(store.avg_receipt_sum_rub, 2)} ₽</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                ) : (
                  <Box textAlign="center" py={8}>
                    <Text color="gray.500">Нет данных о магазинах</Text>
                  </Box>
                )}
              </CardBody>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Layout>
  );
};

export default Analytics;