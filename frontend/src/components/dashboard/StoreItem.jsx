import React from "react";
import PropTypes from "prop-types";
import { HStack, Text, useColorModeValue } from "@chakra-ui/react";

const StoreItem = ({ index, name, amount }) => {
  return (
    <HStack
      justifyContent="space-between"
      p={2}
      bg={useColorModeValue("gray.50", "gray.700")}
      borderRadius="md"
    >
      <HStack spacing={2}>
        <Text fontWeight="bold" fontSize="sm" minWidth="20px">
          {index + 1}.
        </Text>
        <Text fontSize="sm" isTruncated maxW="150px">
          {name}
        </Text>
      </HStack>
      <Text fontWeight="medium" fontSize="sm">
        {amount.toFixed(2)} ₽
      </Text>
    </HStack>
  );
};

StoreItem.propTypes = {
  index: PropTypes.number.isRequired,
  name: PropTypes.string.isRequired,
  amount: PropTypes.number.isRequired,
};

export default StoreItem;
