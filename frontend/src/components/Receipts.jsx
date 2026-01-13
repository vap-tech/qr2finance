import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Button,
  VStack,
  HStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  useToast,
  Spinner,
  Input,
  FormControl,
  FormLabel,
} from '@chakra-ui/react';
import { useDropzone } from 'react-dropzone';
import Layout from './Layout';
import { receiptsAPI } from '../services/api';
import { format } from 'date-fns';

const Receipts = () => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    try {
      const response = await receiptsAPI.getReceipts();
      setReceipts(response.data);
    } catch (error) {
      console.error('Error fetching receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'application/json': ['.json'],
    },
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;

      setUploading(true);
      try {
        await receiptsAPI.uploadReceipt(acceptedFiles[0]);
        toast({
          title: 'Receipt uploaded successfully',
          status: 'success',
          duration: 3000,
        });
        fetchReceipts();
      } catch (error) {
        toast({
          title: 'Upload failed',
          description: error.response?.data?.detail || 'Error uploading file',
          status: 'error',
          duration: 5000,
        });
      } finally {
        setUploading(false);
      }
    },
  });

  const viewReceiptDetails = (receipt) => {
    setSelectedReceipt(receipt);
    onOpen();
  };

  if (loading) {
    return (
      <Layout>
        <Box textAlign="center" py={10}>
          <Spinner size="xl" color="teal.500" />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <HStack justifyContent="space-between" mb={6}>
        <Heading>Receipts</Heading>
        <Box
          {...getRootProps()}
          border="2px dashed"
          borderColor="gray.300"
          borderRadius="md"
          p={4}
          textAlign="center"
          cursor="pointer"
          _hover={{ borderColor: 'teal.500' }}
        >
          <input {...getInputProps()} />
          <Text>
            {uploading ? 'Uploading...' : 'Drag & drop JSON receipt file here, or click to select'}
          </Text>
        </Box>
      </HStack>

      <Box
        bg="white"
        borderRadius="lg"
        shadow="sm"
        overflow="hidden"
      >
        <Table variant="simple">
          <Thead bg="gray.50">
            <Tr>
              <Th>Date</Th>
              <Th>Store</Th>
              <Th isNumeric>Amount</Th>
              <Th>Payment</Th>
              <Th>Items</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {receipts.map((receipt) => (
              <Tr key={receipt.receipt_id} _hover={{ bg: 'gray.50' }}>
                <Td>
                  {format(new Date(receipt.date_time), 'dd.MM.yyyy HH:mm')}
                </Td>
                <Td>{receipt.retail_place || 'Unknown'}</Td>
                <Td isNumeric fontWeight="bold">
                  {(receipt.total_sum / 1).toFixed(2)}₽
                </Td>
                <Td>
                  <Badge colorScheme={receipt.cash_total_sum > 0 ? 'green' : 'blue'}>
                    {receipt.cash_total_sum > 0 ? 'Cash' : 'Card'}
                  </Badge>
                </Td>
                <Td>{receipt.items?.length || 0} items</Td>
                <Td>
                  <Button
                    size="sm"
                    colorScheme="teal"
                    onClick={() => viewReceiptDetails(receipt)}
                  >
                    View
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Receipt Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {selectedReceipt && (
              <VStack align="stretch" spacing={4}>
                <HStack justifyContent="space-between">
                  <Text fontWeight="bold">Store:</Text>
                  <Text>{selectedReceipt.retail_place}</Text>
                </HStack>
                <HStack justifyContent="space-between">
                  <Text fontWeight="bold">Date:</Text>
                  <Text>
                    {format(new Date(selectedReceipt.date_time), 'dd.MM.yyyy HH:mm')}
                  </Text>
                </HStack>
                <HStack justifyContent="space-between">
                  <Text fontWeight="bold">Total:</Text>
                  <Text fontSize="lg" fontWeight="bold">
                    {(selectedReceipt.total_sum / 1).toFixed(2)}₽
                  </Text>
                </HStack>

                <Box mt={4}>
                  <Text fontWeight="bold" mb={2}>Items:</Text>
                  <Box
                    maxH="300px"
                    overflowY="auto"
                    border="1px solid"
                    borderColor="gray.200"
                    borderRadius="md"
                    p={2}
                  >
                    {selectedReceipt.items?.map((item, index) => (
                      <HStack
                        key={item.item_id || index}
                        justifyContent="space-between"
                        p={2}
                        bg={index % 2 === 0 ? 'gray.50' : 'white'}
                      >
                        <Text flex={2}>{item.name}</Text>
                        <Text flex={1} textAlign="right">
                          {item.quantity} × {(item.price / 1).toFixed(2)}₽
                        </Text>
                        <Text flex={1} textAlign="right" fontWeight="bold">
                          {(item.sum / 1).toFixed(2)}₽
                        </Text>
                      </HStack>
                    ))}
                  </Box>
                </Box>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Layout>
  );
};

export default Receipts;