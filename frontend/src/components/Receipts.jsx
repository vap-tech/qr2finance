import React, { useState, useEffect } from "react";
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
  Tag,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from "@chakra-ui/react";
import { useDropzone } from "react-dropzone";
import Layout from "./Layout";
import { receiptsAPI } from "../services/api";
import { format } from "date-fns";

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

  // Функция для конвертации копеек в рубли
  const kopecksToRubles = (kopecks) => {
    if (kopecks === null || kopecks === undefined) return 0;
    // Все суммы из API приходят в копейках, делим на 100
    return Number(kopecks) / 100;
  };

  const fetchReceipts = async () => {
    try {
      const response = await receiptsAPI.getReceipts();
      console.log("Receipts response:", response.data);
      setReceipts(response.data || []);
    } catch (error) {
      console.error("Error fetching receipts:", error);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить чеки",
        status: "error",
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      "application/json": [".json"],
      "image/*": [".png", ".jpg", ".jpeg"],
    },
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;

      setUploading(true);
      try {
        await receiptsAPI.uploadReceipt(acceptedFiles[0]);
        toast({
          title: "Чек успешно загружен",
          status: "success",
          duration: 3000,
        });
        fetchReceipts();
      } catch (error) {
        console.error("Upload error:", error);
        toast({
          title: "Ошибка загрузки",
          description:
            error.response?.data?.detail || "Ошибка при загрузке файла",
          status: "error",
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
        <Heading>Чеки</Heading>
        <Box
          {...getRootProps()}
          border="2px dashed"
          borderColor="gray.300"
          borderRadius="md"
          p={4}
          textAlign="center"
          cursor="pointer"
          _hover={{ borderColor: "teal.500" }}
          bg="gray.50"
        >
          <input {...getInputProps()} />
          <Text>
            {uploading
              ? "Загрузка..."
              : "Перетащите JSON или изображение чека сюда, или кликните для выбора файла"}
          </Text>
          <Text fontSize="sm" color="gray.500" mt={2}>
            Поддерживаемые форматы: JSON, PNG, JPG
          </Text>
        </Box>
      </HStack>

      <Box bg="white" borderRadius="lg" shadow="sm" overflow="hidden">
        {receipts.length > 0 ? (
          <Table variant="simple">
            <Thead bg="gray.50">
              <Tr>
                <Th>Дата</Th>
                <Th>Магазин</Th>
                <Th>Кассир</Th>
                <Th isNumeric>Сумма</Th>
                <Th>Товаров</Th>
                <Th>Действия</Th>
              </Tr>
            </Thead>
            <Tbody>
              {receipts.map((receipt) => {
                // Конвертируем сумму из копеек в рубли
                const totalSumRub = kopecksToRubles(receipt.total_sum);
                const storeName =
                  receipt.shop?.retail_name || "Неизвестный магазин";
                const cashierName = receipt.cashier?.name || "Не указан";
                const itemsCount = receipt.items?.length || 0;

                return (
                  <Tr
                    key={receipt.id || receipt.external_id}
                    _hover={{ bg: "gray.50" }}
                  >
                    <Td>
                      {receipt.date_time
                        ? format(
                            new Date(receipt.date_time),
                            "dd.MM.yyyy HH:mm",
                          )
                        : "Нет даты"}
                    </Td>
                    <Td>
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="medium">{storeName}</Text>
                        {receipt.shop?.legal_name && (
                          <Tag size="sm" colorScheme="blue" mt={1}>
                            {receipt.shop.legal_name}
                          </Tag>
                        )}
                      </VStack>
                    </Td>
                    <Td>
                      <Text fontSize="sm">{cashierName}</Text>
                    </Td>
                    <Td isNumeric fontWeight="bold">
                      {totalSumRub.toFixed(2)} ₽
                    </Td>
                    <Td>{itemsCount} шт.</Td>
                    <Td>
                      <Button
                        size="sm"
                        colorScheme="teal"
                        onClick={() => viewReceiptDetails(receipt)}
                      >
                        Подробнее
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        ) : (
          <Box textAlign="center" py={8}>
            <Text color="gray.500">Нет загруженных чеков</Text>
            <Text fontSize="sm" color="gray.400" mt={2}>
              Загрузите чек для просмотра деталей
            </Text>
          </Box>
        )}
      </Box>

      {/* Модальное окно с деталями чека */}
      <Modal isOpen={isOpen} onClose={onClose} size="4xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Детали чека</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {selectedReceipt && (
              <VStack align="stretch" spacing={4}>
                {/* Информация о магазине */}
                <Box p={4} bg="gray.50" borderRadius="md">
                  <Heading size="md" mb={3}>
                    Магазин
                  </Heading>
                  <HStack justifyContent="space-between">
                    <Text fontWeight="bold">Название:</Text>
                    <Text>
                      {selectedReceipt.shop?.retail_name || "Не указано"}
                    </Text>
                  </HStack>
                  {selectedReceipt.shop?.legal_name && (
                    <HStack justifyContent="space-between" mt={2}>
                      <Text fontWeight="bold">Сеть:</Text>
                      <Text>{selectedReceipt.shop.legal_name}</Text>
                    </HStack>
                  )}
                  {selectedReceipt.shop?.address && (
                    <HStack justifyContent="space-between" mt={2}>
                      <Text fontWeight="bold">Адрес:</Text>
                      <Text fontSize="sm" textAlign="right" maxW="70%">
                        {selectedReceipt.shop.address}
                      </Text>
                    </HStack>
                  )}
                </Box>

                {/* Информация о чеке */}
                <Box p={4} bg="gray.50" borderRadius="md">
                  <Heading size="md" mb={3}>
                    Информация о чеке
                  </Heading>
                  <HStack justifyContent="space-between">
                    <Text fontWeight="bold">Дата:</Text>
                    <Text>
                      {selectedReceipt.date_time
                        ? format(
                            new Date(selectedReceipt.date_time),
                            "dd.MM.yyyy HH:mm",
                          )
                        : "Нет даты"}
                    </Text>
                  </HStack>
                  <HStack justifyContent="space-between" mt={2}>
                    <Text fontWeight="bold">Кассир:</Text>
                    <Text>{selectedReceipt.cashier?.name || "Не указан"}</Text>
                  </HStack>
                  <HStack justifyContent="space-between" mt={2}>
                    <Text fontWeight="bold">ФН:</Text>
                    <Text fontFamily="monospace">
                      {selectedReceipt.fiscal_drive_number}
                    </Text>
                  </HStack>
                  <HStack justifyContent="space-between" mt={2}>
                    <Text fontWeight="bold">ФД №:</Text>
                    <Text>{selectedReceipt.fiscal_document_number}</Text>
                  </HStack>
                  <HStack justifyContent="space-between" mt={2}>
                    <Text fontWeight="bold">ФП:</Text>
                    <Text fontFamily="monospace">
                      {selectedReceipt.fiscal_sign}
                    </Text>
                  </HStack>
                </Box>

                {/* Сумма */}
                <Box p={4} bg="teal.50" borderRadius="md">
                  <HStack justifyContent="space-between">
                    <Text fontWeight="bold" fontSize="lg">
                      Итого:
                    </Text>
                    <Text fontSize="xl" fontWeight="bold">
                      {kopecksToRubles(selectedReceipt.total_sum).toFixed(2)} ₽
                    </Text>
                  </HStack>
                </Box>

                {/* Товары */}
                <Box mt={4}>
                  <Heading size="md" mb={3}>
                    Товары
                  </Heading>
                  {selectedReceipt.items && selectedReceipt.items.length > 0 ? (
                    <Box
                      maxH="400px"
                      overflowY="auto"
                      border="1px solid"
                      borderColor="gray.200"
                      borderRadius="md"
                    >
                      <Table variant="simple" size="sm">
                        <Thead bg="gray.100" position="sticky" top={0}>
                          <Tr>
                            <Th>Товар</Th>
                            <Th isNumeric>Кол-во</Th>
                            <Th isNumeric>Цена</Th>
                            <Th isNumeric>Сумма</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {selectedReceipt.items.map((item, index) => {
                            const itemPrice = kopecksToRubles(item.price);
                            const itemSum = kopecksToRubles(item.sum);

                            return (
                              <Tr
                                key={item.id || index}
                                _hover={{ bg: "gray.50" }}
                              >
                                <Td>
                                  <VStack align="start" spacing={0}>
                                    <Text>{item.name}</Text>
                                    {item.gtin && (
                                      <Text
                                        fontSize="xs"
                                        color="gray.500"
                                        fontFamily="monospace"
                                      >
                                        GTIN: {item.gtin}
                                      </Text>
                                    )}
                                  </VStack>
                                </Td>
                                <Td isNumeric>
                                  {item.quantity} {item.measure}
                                </Td>
                                <Td isNumeric>{itemPrice.toFixed(2)} ₽</Td>
                                <Td isNumeric fontWeight="bold">
                                  {itemSum.toFixed(2)} ₽
                                </Td>
                              </Tr>
                            );
                          })}
                        </Tbody>
                      </Table>
                    </Box>
                  ) : (
                    <Text color="gray.500">Нет информации о товарах</Text>
                  )}
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
