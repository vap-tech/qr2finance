import React from "react";
import PropTypes from "prop-types";
import {
  Card,
  CardBody,
  Heading,
  Box,
  VStack,
  Text,
  HStack,
  Progress,
  useColorModeValue,
  Icon,
} from "@chakra-ui/react";
import { FaStore } from "react-icons/fa";
import StoreItem from "./StoreItem";

const StoreStatistics = ({ receipts, stats }) => {
  const uniqueStores = new Set(
    receipts
      .map((r) => r.shop_name)
      .filter((name) => name && name !== "Неизвестный магазин"),
  ).size;

  const totalSpentByStore = receipts.reduce((acc, receipt) => {
    const store = receipt.shop_name;
    if (!acc[store]) acc[store] = 0;
    acc[store] += receipt.total_sum_rub || 0;
    return acc;
  }, {});

  const topStores = Object.entries(totalSpentByStore)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <Card bg={useColorModeValue("white", "gray.800")} shadow="sm">
      <CardBody>
        <Heading size="md" mb={4} display="flex" alignItems="center" gap={2}>
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
                  {receipts.length}
                </Text>
                <Text fontSize="sm" color="gray.500">
                  за всё время
                </Text>
              </HStack>
              <Progress
                value={Math.min(receipts.length * 2, 100)}
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

            {stats.receipts_count > 0 && stats.total_sum_rub > 0 && (
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>
                  Средний чек
                </Text>
                <Text fontSize="2xl" fontWeight="bold">
                  {(stats.total_sum_rub / stats.receipts_count).toFixed(2)} ₽
                </Text>
                <Text fontSize="xs" color="gray.500">
                  за текущий месяц
                </Text>
              </Box>
            )}
          </VStack>
        </Box>

        {topStores.length > 0 && (
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={3}>
              Топ магазины по тратам
            </Text>
            <VStack align="stretch" spacing={2}>
              {topStores.map(([store, amount], index) => (
                <StoreItem
                  key={store}
                  index={index}
                  name={store}
                  amount={amount}
                />
              ))}
            </VStack>
          </Box>
        )}
      </CardBody>
    </Card>
  );
};

StoreStatistics.propTypes = {
  receipts: PropTypes.array.isRequired,
  stats: PropTypes.shape({
    receipts_count: PropTypes.number,
    total_sum_rub: PropTypes.number,
  }).isRequired,
};

export default StoreStatistics;
