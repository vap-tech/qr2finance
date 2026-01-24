import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  Tag,
  VStack,
} from "@chakra-ui/react";
import { FaMapMarkerAlt } from "react-icons/fa";
import EmptyState from "../shared/EmptyState";

const StoreStatsTable = ({ stats }) => {
  if (stats.length === 0) {
    return (
      <EmptyState
        title="Нет статистики по магазинам"
        description="Загрузите чеки чтобы увидеть статистику"
      />
    );
  }

  return (
    <Box bg="white" borderRadius="lg" shadow="sm" overflow="hidden">
      <Table variant="simple">
        <Thead bg="gray.50">
          <Tr>
            <Th>№</Th>
            <Th>Магазин</Th>
            <Th>Оф. название</Th>
            <Th isNumeric>Чеков</Th>
            <Th isNumeric>Потрачено</Th>
            <Th isNumeric>Ср. чек</Th>
          </Tr>
        </Thead>
        <Tbody>
          {stats.map((store) => (
            <Tr key={store.id} _hover={{ bg: "gray.50" }}>
              <Td isNumeric color="gray.400" fontSize="xs" width="50px">
                #{store.id}
              </Td>
              <Td>
                <VStack align="start" spacing={1}>
                  <Text fontWeight="medium">{store.retail_name}</Text>
                  {store.chain_name && (
                    <Tag size="sm" colorScheme="blue">
                      {store.chain_name}
                    </Tag>
                  )}
                  {store.address && (
                    <Text fontSize="xs" color="gray.600">
                      <FaMapMarkerAlt
                        style={{ display: "inline", marginRight: "4px" }}
                      />
                      {store.address}
                    </Text>
                  )}
                </VStack>
              </Td>
              <Td>{store.legal_name}</Td>
              <Td isNumeric>{store.receipts_count}</Td>
              <Td isNumeric>{store.total_spent_rub.toFixed(2)} ₽</Td>
              <Td isNumeric>{store.avg_receipt_rub.toFixed(2)} ₽</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
};

StoreStatsTable.propTypes = {
  stats: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      retail_name: PropTypes.string.isRequired,
      legal_name: PropTypes.string.isRequired,
      total_spent_rub: PropTypes.number.isRequired,
      receipts_count: PropTypes.number.isRequired,
      avg_receipt_rub: PropTypes.number.isRequired,
      chain_name: PropTypes.string,
      address: PropTypes.string,
    }),
  ).isRequired,
};

export default StoreStatsTable;
