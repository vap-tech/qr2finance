import React, { useState, useEffect } from 'react';
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
} from '@chakra-ui/react';
import { FaReceipt, FaStore, FaMoneyBillWave, FaCreditCard } from 'react-icons/fa';
import { analyticsAPI, receiptsAPI } from '../services/api';
import Layout from './Layout';
import LoadingSpinner from './LoadingSpinner';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentReceipts, setRecentReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [monthlyStatsRes, receiptsRes] = await Promise.all([
        analyticsAPI.getMonthlyStats(),
        receiptsAPI.getReceipts(0, 50),
      ]);

      const monthlyStats = monthlyStatsRes.data;
      const receipts = receiptsRes.data;

      if (monthlyStats.length > 0) {
        // Конвертируем Decimal в числа
        const currentMonth = {
          ...monthlyStats[0],
          total_sum_rub: parseFloat(monthlyStats[0].total_sum_rub) || 0,
          cash_sum_rub: parseFloat(monthlyStats[0].cash_sum_rub) || 0,
          ecash_sum_rub: parseFloat(monthlyStats[0].ecash_sum_rub) || 0,
        };
        setStats(currentMonth);
      } else {
        // Если нет статистики, создаем пустую
        setStats({
          receipts_count: 0,
          total_sum_rub: 0,
          cash_sum_rub: 0,
          ecash_sum_rub: 0,
        });
      }

      // Конвертируем суммы в чеках
      const formattedReceipts = receipts.map(receipt => ({
        ...receipt,
        total_sum: parseFloat(receipt.total_sum) || 0,
        cash_total_sum: parseFloat(receipt.cash_total_sum) || 0,
      }));

      setRecentReceipts(formattedReceipts);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Устанавливаем значения по умолчанию при ошибке
      setStats({
        receipts_count: 0,
        total_sum_rub: 0,
        cash_sum_rub: 0,
        ecash_sum_rub: 0,
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
  const totalAmount = stats?.total_sum_rub ? Number(stats.total_sum_rub) : 0;
  const cashAmount = stats?.cash_sum_rub ? Number(stats.cash_sum_rub) : 0;
  const cardAmount = stats?.ecash_sum_rub ? Number(stats.ecash_sum_rub) : 0;
  const cashPercentage = totalAmount > 0 ? (cashAmount / totalAmount) * 100 : 0;
  const cardPercentage = totalAmount > 0 ? (cardAmount / totalAmount) * 100 : 0;

  return (
    <Layout>
      <Heading mb={6} size="xl">📊 Дашборд</Heading>

      {stats && (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={8}>
          <Card bg={useColorModeValue('white', 'gray.800')}>
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

          <Card bg={useColorModeValue('white', 'gray.800')}>
            <CardBody>
              <Stat>
                <HStack>
                  <Icon as={FaMoneyBillWave} color="brand.500" boxSize={6} />
                  <StatLabel>Общие расходы</StatLabel>
                </HStack>
                <StatNumber>{totalAmount.toFixed(2)} ₽</StatNumber>
                <StatHelpText>За текущий месяц</StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card bg={useColorModeValue('white', 'gray.800')}>
            <CardBody>
              <Stat>
                <HStack>
                  <Icon as={FaMoneyBillWave} color="green.500" boxSize={6} />
                  <StatLabel>Наличные</StatLabel>
                </HStack>
                <StatNumber>{cashAmount.toFixed(2)} ₽</StatNumber>
                <Progress value={cashPercentage} colorScheme="green" size="sm" mt={2} />
              </Stat>
            </CardBody>
          </Card>

          <Card bg={useColorModeValue('white', 'gray.800')}>
            <CardBody>
              <Stat>
                <HStack>
                  <Icon as={FaCreditCard} color="blue.500" boxSize={6} />
                  <StatLabel>Карта</StatLabel>
                </HStack>
                <StatNumber>{cardAmount.toFixed(2)} ₽</StatNumber>
                <Progress value={cardPercentage} colorScheme="blue" size="sm" mt={2} />
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>
      )}

      <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
        <GridItem>
          <Card bg={useColorModeValue('white', 'gray.800')}>
            <CardBody>
              <Heading size="md" mb={4} display="flex" alignItems="center" gap={2}>
                <Icon as={FaReceipt} /> Последние чеки
              </Heading>
              {recentReceipts.length > 0 ? (
                recentReceipts.map((receipt) => {
                  const receiptTotal = receipt.total_sum;
                  return (
                    <Box
                      key={receipt.receipt_id}
                      p={4}
                      mb={3}
                      bg={useColorModeValue('gray.50', 'gray.700')}
                      borderRadius="lg"
                      borderLeft="4px solid"
                      borderColor="brand.500"
                    >
                      <HStack justifyContent="space-between" mb={2}>
                        <Text fontWeight="bold">
                          {receiptTotal.toFixed(2)} ₽
                        </Text>
                        <Badge colorScheme={receipt.cash_total_sum > 0 ? 'green' : 'blue'}>
                          {receipt.cash_total_sum > 0 ? 'НАЛИЧНЫЕ' : 'КАРТА'}
                        </Badge>
                      </HStack>
                      <Text fontSize="sm" color="gray.600">
                        {receipt.retail_place || 'Неизвестный магазин'}
                      </Text>
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        {new Date(receipt.date_time).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {receipt.items?.length || 0} товаров
                      </Text>
                    </Box>
                  );
                })
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
          <Card bg={useColorModeValue('white', 'gray.800')}>
            <CardBody>
              <Heading size="md" mb={4} display="flex" alignItems="center" gap={2}>
                <Icon as={FaStore} /> Статистика
              </Heading>
              <Text mb={4}>Быстрые действия:</Text>

              <Box mb={4}>
                <Text fontSize="sm" fontWeight="medium" mb={2}>
                  Всего чеков: {recentReceipts.length}
                </Text>
                <Progress
                  value={Math.min(recentReceipts.length * 10, 100)}
                  colorScheme="brand"
                  size="sm"
                  borderRadius="full"
                />
              </Box>

              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>
                  Уникальных магазинов: {
                    new Set(recentReceipts.map(r => r.retail_place).filter(Boolean)).size
                  }
                </Text>
                <Progress
                  value={Math.min(new Set(recentReceipts.map(r => r.retail_place).filter(Boolean)).size * 20, 100)}
                  colorScheme="green"
                  size="sm"
                  borderRadius="full"
                />
              </Box>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    </Layout>
  );
};

export default Dashboard;