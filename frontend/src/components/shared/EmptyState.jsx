import React from "react";
import PropTypes from "prop-types";
import { Box, Text } from "@chakra-ui/react";

const EmptyState = ({ title, description }) => {
  return (
    <Box textAlign="center" py={8}>
      <Text color="gray.500">{title}</Text>
      {description && (
        <Text fontSize="sm" color="gray.400" mt={2}>
          {description}
        </Text>
      )}
    </Box>
  );
};

EmptyState.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
};

export default EmptyState;
