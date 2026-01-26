import React from "react";
import PropTypes from "prop-types";
import {
  Tr,
  Td,
  Text,
  VStack,
  Tag,
  Button,
  Badge,
  HStack,
} from "@chakra-ui/react";
import { format } from "date-fns";

const ReceiptRow = ({ receipt, onViewDetails }) => {
  const formatDateTime = (dateTime) => {
    if (!dateTime) return "Нет даты";
    try {
      return format(new Date(dateTime), "dd.MM.yyyy HH:mm");
    } catch {
      return "Некорректная дата";
    }
  };

  const getPaymentBadge = (receipt) => {
    if (receipt.cash_total_sum > 0) {
      return <Badge colorScheme="green">НАЛИЧНЫЕ</Badge>;
    } else if (receipt.ecash_total_sum > 0) {
      return <Badge colorScheme="blue">КАРТА</Badge>;
    }
    return null;
  };

  return (
    <Tr _hover={{ bg: "gray.50" }} transition="background-color 0.2s">
      <Td>
        <VStack align="start" spacing={1}>
          <Text>{formatDateTime(receipt.date_time)}</Text>
          {getPaymentBadge(receipt)}
        </VStack>
      </Td>
      <Td>
        <VStack align="start" spacing={1}>
          <Text fontWeight="medium">{receipt.shop_name}</Text>
          {receipt.shop_legal_name && (
            <Tag size="sm" colorScheme="blue">
              {receipt.shop_legal_name}
            </Tag>
          )}
        </VStack>
      </Td>
      <Td>
        <Text fontSize="sm">{receipt.cashier_name}</Text>
      </Td>
      <Td isNumeric fontWeight="bold">
        {receipt.total_sum_rub?.toFixed(2)} ₽
      </Td>
      <Td isNumeric>
        <Text>{receipt.items_count} шт.</Text>
      </Td>
      <Td>
        <HStack spacing={2}>
          <Button
            size="sm"
            colorScheme="teal"
            onClick={() => onViewDetails(receipt)}
          >
            Подробнее
          </Button>
          <Button size="sm" variant="outline" colorScheme="blue">
            PDF
          </Button>
        </HStack>
      </Td>
    </Tr>
  );
};

ReceiptRow.propTypes = {
  receipt: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    date_time: PropTypes.string,
    total_sum_rub: PropTypes.number.isRequired,
    cash_total_sum: PropTypes.number,
    ecash_total_sum: PropTypes.number,
    shop_name: PropTypes.string.isRequired,
    shop_legal_name: PropTypes.string,
    cashier_name: PropTypes.string.isRequired,
    items_count: PropTypes.number.isRequired,
  }).isRequired,
  onViewDetails: PropTypes.func.isRequired,
};

export default ReceiptRow;
