import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Text,
  Badge,
  HStack,
  VStack,
  Tag,
  useColorModeValue,
} from "@chakra-ui/react";
import { formatDate } from "../../utils/format";

const ReceiptItem = ({ receipt }) => {
  return (
    <Box
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
        <Badge colorScheme={receipt.cash_total_sum > 0 ? "green" : "blue"}>
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
          {formatDate(receipt.date_time)} • {receipt.items_count} товаров
        </Text>
      </VStack>
    </Box>
  );
};

ReceiptItem.propTypes = {
  receipt: PropTypes.shape({
    total_sum_rub: PropTypes.number.isRequired,
    cash_total_sum: PropTypes.number,
    shop_name: PropTypes.string.isRequired,
    shop_chain: PropTypes.string,
    cashier_name: PropTypes.string,
    date_time: PropTypes.string,
    items_count: PropTypes.number.isRequired,
  }).isRequired,
};

export default ReceiptItem;
