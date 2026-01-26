import React from "react";
import PropTypes from "prop-types";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  HStack,
  Box,
  Heading,
  Text as ChakraText, // Переименовываем чтобы избежать конфликта
  Badge,
  Tag,
  useColorModeValue,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from "@chakra-ui/react";
import { format } from "date-fns";

const ReceiptDetailsModal = ({ isOpen, onClose, receipt }) => {
  const sectionBg = useColorModeValue("gray.50", "gray.700");
  const totalBg = useColorModeValue("teal.50", "teal.900");
  const headerBg = useColorModeValue("gray.100", "gray.600");

  if (!receipt) return null;

  const formatDateTime = (dateTime) => {
    if (!dateTime) return "Нет даты";
    try {
      return format(new Date(dateTime), "dd.MM.yyyy HH:mm");
    } catch {
      return "Некорректная дата";
    }
  };

  const getPaymentType = () => {
    if (receipt.cash_total_sum > 0) return { type: "НАЛИЧНЫЕ", color: "green" };
    if (receipt.ecash_total_sum > 0) return { type: "КАРТА", color: "blue" };
    return { type: "НЕИЗВЕСТНО", color: "gray" };
  };

  const paymentType = getPaymentType();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          Детали чека
          <ChakraText fontSize="sm" fontWeight="normal" color="gray.500" mt={1}>
            {formatDateTime(receipt.date_time)}
          </ChakraText>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack align="stretch" spacing={4}>
            {/* Шапка с основной информацией */}
            <HStack justifyContent="space-between" wrap="wrap" spacing={4}>
              <Box>
                <ChakraText fontWeight="bold" fontSize="lg">
                  {receipt.shop_name}
                </ChakraText>
                {receipt.shop_legal_name && (
                  <ChakraText fontSize="sm" color="gray.600">
                    {receipt.shop_legal_name}
                  </ChakraText>
                )}
              </Box>
              <Badge
                colorScheme={paymentType.color}
                fontSize="md"
                px={3}
                py={1}
              >
                {paymentType.type}
              </Badge>
            </HStack>

            {/* Детальная информация */}
            <Box p={4} bg={sectionBg} borderRadius="md">
              <SimpleGrid columns={2} spacing={4}>
                <Box>
                  <ChakraText fontSize="sm" color="gray.600">
                    ФН
                  </ChakraText>
                  <ChakraText fontFamily="monospace" fontSize="sm">
                    {receipt.fiscal_drive_number || "Не указан"}
                  </ChakraText>
                </Box>
                <Box>
                  <ChakraText fontSize="sm" color="gray.600">
                    ФД №
                  </ChakraText>
                  <ChakraText>
                    {receipt.fiscal_document_number || "Не указан"}
                  </ChakraText>
                </Box>
                <Box>
                  <ChakraText fontSize="sm" color="gray.600">
                    ФП
                  </ChakraText>
                  <ChakraText fontFamily="monospace" fontSize="sm">
                    {receipt.fiscal_sign || "Не указан"}
                  </ChakraText>
                </Box>
                <Box>
                  <ChakraText fontSize="sm" color="gray.600">
                    Кассир
                  </ChakraText>
                  <ChakraText>{receipt.cashier_name}</ChakraText>
                </Box>
                {receipt.cashier?.inn && (
                  <Box>
                    <ChakraText fontSize="sm" color="gray.600">
                      ИНН кассира
                    </ChakraText>
                    <ChakraText>{receipt.cashier.inn}</ChakraText>
                  </Box>
                )}
              </SimpleGrid>
            </Box>

            {/* Общая сумма */}
            <Box p={4} bg={totalBg} borderRadius="md">
              <HStack justifyContent="space-between">
                <ChakraText fontWeight="bold" fontSize="xl">
                  Итого к оплате:
                </ChakraText>
                <ChakraText fontSize="2xl" fontWeight="bold">
                  {receipt.total_sum_rub?.toFixed(2)} ₽
                </ChakraText>
              </HStack>
              {receipt.cash_total_sum > 0 && (
                <ChakraText fontSize="sm" mt={2}>
                  Наличными: {receipt.cash_total_sum_rub?.toFixed(2)} ₽
                </ChakraText>
              )}
              {receipt.ecash_total_sum > 0 && (
                <ChakraText fontSize="sm">
                  Безналичными: {receipt.ecash_total_sum_rub?.toFixed(2)} ₽
                </ChakraText>
              )}
            </Box>

            {/* Товары */}
            <Box>
              <Heading size="md" mb={3}>
                Товары ({receipt.items_count})
              </Heading>
              {receipt.formatted_items?.length > 0 ? (
                <Box
                  maxH="400px"
                  overflowY="auto"
                  border="1px solid"
                  borderColor={useColorModeValue("gray.200", "gray.600")}
                  borderRadius="md"
                >
                  <Table variant="simple" size="sm">
                    <Thead bg={headerBg} position="sticky" top={0}>
                      <Tr>
                        <Th>Наименование</Th>
                        <Th isNumeric>Количество</Th>
                        <Th isNumeric>Цена</Th>
                        <Th isNumeric>Сумма</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {receipt.formatted_items.map((item, index) => (
                        <Tr key={item.id || index} _hover={{ bg: sectionBg }}>
                          <Td>
                            <VStack align="start" spacing={0}>
                              <ChakraText>{item.name}</ChakraText>
                              {item.gtin && (
                                <ChakraText
                                  fontSize="xs"
                                  color="gray.500"
                                  fontFamily="monospace"
                                >
                                  Штрихкод: {item.gtin}
                                </ChakraText>
                              )}
                            </VStack>
                          </Td>
                          <Td isNumeric>
                            {item.quantity} {item.measure}
                          </Td>
                          <Td isNumeric>{item.price_rub?.toFixed(2)} ₽</Td>
                          <Td isNumeric fontWeight="bold">
                            {item.sum_rub?.toFixed(2)} ₽
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              ) : (
                <ChakraText color="gray.500">
                  Нет информации о товарах
                </ChakraText>
              )}
            </Box>

            {/* Дополнительная информация */}
            {receipt.shop?.address && (
              <Box p={4} bg={sectionBg} borderRadius="md">
                <ChakraText fontWeight="bold" mb={2}>
                  Адрес магазина:
                </ChakraText>
                <ChakraText fontSize="sm">{receipt.shop.address}</ChakraText>
              </Box>
            )}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

// Простой Grid для деталей
const SimpleGrid = ({ children, columns = 2, spacing = 4 }) => {
  return (
    <Box
      display="grid"
      gridTemplateColumns={`repeat(${columns}, 1fr)`}
      gap={spacing}
    >
      {children}
    </Box>
  );
};

SimpleGrid.propTypes = {
  children: PropTypes.node.isRequired,
  columns: PropTypes.number,
  spacing: PropTypes.number,
};

ReceiptDetailsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  receipt: PropTypes.object,
};

export default ReceiptDetailsModal;
