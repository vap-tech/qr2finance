import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import ReceiptRow from "./ReceiptRow";
import EmptyState from "../shared/EmptyState";

const ReceiptsTable = ({ receipts, onViewDetails }) => {
  const headerBg = useColorModeValue("gray.50", "gray.700");

  if (receipts.length === 0) {
    return (
      <EmptyState
        title="Нет загруженных чеков"
        description="Загрузите первый чек чтобы увидеть его здесь"
      />
    );
  }

  return (
    <Box
      bg={useColorModeValue("white", "gray.800")}
      borderRadius="lg"
      shadow="sm"
      overflow="hidden"
    >
      <Table variant="simple">
        <Thead bg={headerBg}>
          <Tr>
            <Th>Дата</Th>
            <Th>Магазин</Th>
            <Th>Кассир</Th>
            <Th isNumeric>Сумма</Th>
            <Th isNumeric>Товаров</Th>
            <Th>Действия</Th>
          </Tr>
        </Thead>
        <Tbody>
          {receipts.map((receipt) => (
            <ReceiptRow
              key={receipt.id || receipt.external_id}
              receipt={receipt}
              onViewDetails={onViewDetails}
            />
          ))}
        </Tbody>
      </Table>
    </Box>
  );
};

ReceiptsTable.propTypes = {
  receipts: PropTypes.array.isRequired,
  onViewDetails: PropTypes.func.isRequired,
};

export default ReceiptsTable;
