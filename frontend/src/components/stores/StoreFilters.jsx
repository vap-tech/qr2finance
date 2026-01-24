import React from "react";
import PropTypes from "prop-types";
import {
  HStack,
  Select,
  Button,
  Box,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { FaSortAmountDown, FaSortAmountUp } from "react-icons/fa";

const StoreFilters = ({ sortConfig, onSortChange }) => {
  const sortOptions = [
    { value: "total_amount", label: "По сумме расходов" },
    { value: "receipts_count", label: "По количеству чеков" },
    { value: "receipt_avg", label: "По среднему чеку" },
    { value: "retail_name", label: "По названию магазина" },
    { value: "legal_name", label: "По юридическому названию" },
  ];

  const handleSortChange = (field) => {
    // Если кликаем по уже выбранному полю, меняем направление
    if (field === sortConfig.sortBy) {
      onSortChange({ descending: !sortConfig.descending });
    } else {
      // Если новое поле, сбрасываем направление на убывание
      onSortChange({ sortBy: field, descending: true });
    }
  };

  return (
    <Box
      p={4}
      bg={useColorModeValue("gray.50", "gray.800")}
      borderRadius="lg"
      mb={4}
    >
      <HStack justifyContent="space-between" wrap="wrap" spacing={4}>
        <HStack spacing={4}>
          <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
            Сортировка:
          </Text>
          <HStack spacing={2} wrap="wrap">
            {sortOptions.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={
                  sortConfig.sortBy === option.value ? "solid" : "outline"
                }
                colorScheme={
                  sortConfig.sortBy === option.value ? "blue" : "gray"
                }
                onClick={() => handleSortChange(option.value)}
                rightIcon={
                  sortConfig.sortBy === option.value ? (
                    sortConfig.descending ? (
                      <FaSortAmountDown />
                    ) : (
                      <FaSortAmountUp />
                    )
                  ) : null
                }
              >
                {option.label}
              </Button>
            ))}
          </HStack>
        </HStack>

        <Box>
          <Text fontSize="sm" color="gray.500">
            Всего магазинов: {sortConfig.totalStores || 0}
          </Text>
        </Box>
      </HStack>
    </Box>
  );
};

StoreFilters.propTypes = {
  sortConfig: PropTypes.shape({
    sortBy: PropTypes.string.isRequired,
    descending: PropTypes.bool.isRequired,
    totalStores: PropTypes.number,
  }).isRequired,
  onSortChange: PropTypes.func.isRequired,
};

export default StoreFilters;
