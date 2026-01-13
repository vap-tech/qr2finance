// frontend/src/components/LoadingSpinner.jsx
import React from 'react';
import { Center, Spinner, Text, VStack } from '@chakra-ui/react';

const LoadingSpinner = ({ text = 'Загрузка...', size = 'xl' }) => {
  return (
    <Center minH="200px">
      <VStack spacing={4}>
        <Spinner
          size={size}
          color="teal.500"
          thickness="4px"
          emptyColor="gray.200"
          speed="0.65s"
        />
        {text && <Text color="gray.600">{text}</Text>}
      </VStack>
    </Center>
  );
};

export default LoadingSpinner;