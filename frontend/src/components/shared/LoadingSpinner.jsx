import React from "react";
import PropTypes from "prop-types";
import { Center, Spinner, Text, VStack } from "@chakra-ui/react";

const LoadingSpinner = ({ text = "Загрузка...", size = "xl", ...props }) => {
  return (
    <Center h="400px" {...props}>
      <VStack spacing={4}>
        <Spinner
          thickness="4px"
          speed="0.65s"
          emptyColor="gray.200"
          color="brand.500"
          size={size}
        />
        {text && <Text color="gray.500">{text}</Text>}
      </VStack>
    </Center>
  );
};

LoadingSpinner.propTypes = {
  text: PropTypes.string,
  size: PropTypes.oneOf(["xs", "sm", "md", "lg", "xl"]),
};

export default LoadingSpinner;
