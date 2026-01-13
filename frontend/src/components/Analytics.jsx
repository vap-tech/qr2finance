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

const Analytics = () => {
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [storeStats, setStoreStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('6');

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - parseInt(timeRange));

      const [monthlyRes, productsRes, storesRes] = await Promise.all([
        analyticsAPI.getMonthlyStats({
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        }),
        analyticsAPI.getTopProducts(10),
        analyticsAPI.getStoreStats(),
      ]);

      // Конвертируем данные
      const formattedMonthlyStats = (monthlyRes.data || []).map(item => ({
        ...item,
        month: item.month,
        receipts_count: safeToNumber(item.receipts_count),
        total_sum_rub: safeToNumber(item.total_sum_rub),
        cash_sum_rub: safeToNumber(item.cash_sum_rub),
        ecash_sum_rub: safeToNumber(item.ecash_sum_rub),
      }));

      const formattedTopProducts = (productsRes.data || []).map(product => ({
        ...product,
        name: product.name || 'Без названия',
        total_quantity: safeToNumber(product.total_quantity),
        total_sum_rub: safeToNumber(product.total_sum_rub),
        receipts_count: safeToNumber(product.receipts_count),
      }));

      const formattedStoreStats = (storesRes.data || []).map(store => ({
        ...store,
        retail_place: store.retail_place || 'Неизвестный магазин',
        receipts_count: safeToNumber(store.receipts_count),
        total_sum_rub: safeToNumber(store.total_sum_rub),
        avg_receipt_sum_rub: safeToNumber(store.avg_receipt_sum_rub),
        first_purchase: store.first_purchase,
        last_purchase: store.last_purchase,
      }));

      setMonthlyStats(formattedMonthlyStats);
      setTopProducts(formattedTopProducts);
      setStoreStats(formattedStoreStats);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Устанавливаем пустые массивы при ошибке
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

  return (
    <Layout>
      <HStack justifyContent="space-between" mb={6}>
        <Heading>Аналитика</Heading>
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

      <Tabs colorScheme="teal">
        <TabList>
          <Tab>Обзор расходов</Tab>
          <Tab>Топ товаров</Tab>
          <Tab>Анализ магазинов</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
              <Card>
                <CardBody>
                  <Heading size="sm" mb={4}>Ежемесячные расходы</Heading>
                  <Box height="300px">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="month"
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return `${date.getMonth() + 1}/${date.getFullYear()}`;
                          }}
                        />
                        <YAxis />
                        <Tooltip
                          formatter={(value) => [`${formatNumber(value, 2)} ₽`, 'Сумма']}
                          labelFormatter={(label) => {
                            const date = new Date(label);
                            return `${date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`;
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="total_sum_rub"
                          stroke="#8884d8"
                          name="Всего"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="cash_sum_rub"
                          stroke="#82ca9d"
                          name="Наличные"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="ecash_sum_rub"
                          stroke="#ffc658"
                          name="Карта"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <Heading size="sm" mb={4}>Количество чеков</Heading>
                  <Box height="300px">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="month"
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return `${date.getMonth() + 1}/${date.getFullYear()}`;
                          }}
                        />
                        <YAxis />
                        <Tooltip
                          labelFormatter={(label) => {
                            const date = new Date(label);
                            return `${date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`;
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="receipts_count"
                          fill="#8884d8"
                          name="Количество чеков"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardBody>
              </Card>
            </SimpleGrid>
          </TabPanel>

          <TabPanel>
            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
              <Card>
                <CardBody>
                  <Heading size="sm" mb={4}>Топ 10 товаров по расходам</Heading>
                  <Box height="400px">
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
                  </Box>
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <Heading size="sm" mb={4}>Распределение расходов</Heading>
                  <Box height="400px">
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
                  </Box>
                </CardBody>
              </Card>
            </SimpleGrid>

            <Card mt={6}>
              <CardBody>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Товар</Th>
                      <Th isNumeric>Количество</Th>
                      <Th isNumeric>Потрачено</Th>
                      <Th isNumeric>Чеков</Th>
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
                        <Td isNumeric>{product.receipts_count}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          </TabPanel>

          <TabPanel>
            <Card>
              <CardBody>
                <Heading size="sm" mb={4}>Статистика по магазинам</Heading>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Магазин</Th>
                      <Th isNumeric>Чеков</Th>
                      <Th isNumeric>Потрачено</Th>
                      <Th isNumeric>Ср. чек</Th>
                      <Th>Первый чек</Th>
                      <Th>Последний чек</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {storeStats.map((store, index) => (
                      <Tr key={`${store.retail_place}-${index}`}>
                        <Td maxWidth="200px" overflow="hidden" textOverflow="ellipsis">
                          {store.retail_place}
                        </Td>
                        <Td isNumeric>{store.receipts_count}</Td>
                        <Td isNumeric>{formatNumber(store.total_sum_rub, 2)} ₽</Td>
                        <Td isNumeric>{formatNumber(store.avg_receipt_sum_rub, 2)} ₽</Td>
                        <Td>
                          {store.first_purchase ?
                            new Date(store.first_purchase).toLocaleDateString('ru-RU') :
                            'Н/Д'
                          }
                        </Td>
                        <Td>
                          {store.last_purchase ?
                            new Date(store.last_purchase).toLocaleDateString('ru-RU') :
                            'Н/Д'
                          }
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Layout>
  );
};

export default Analytics;