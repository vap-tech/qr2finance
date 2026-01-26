import React, { useState } from "react";
import {
  Box,
  Heading,
  HStack,
  Text,
  useToast,
  useDisclosure, // Добавляем этот импорт
} from "@chakra-ui/react";
import Layout from "../Layout";
import LoadingSpinner from "../shared/LoadingSpinner";
import UploadZone from "./UploadZone";
import ReceiptsTable from "./ReceiptsTable";
import ReceiptDetailsModal from "./ReceiptDetailsModal";
import { useReceipts } from "../../hooks/useReceipts";

const Receipts = () => {
  const { receipts, loading, uploading, error, fetchReceipts, uploadReceipt } =
    useReceipts();

  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const handleUpload = async (file) => {
    const result = await uploadReceipt(file);

    if (result.success) {
      toast({
        title: "Чек успешно загружен",
        status: "success",
        duration: 3000,
      });
    } else {
      toast({
        title: "Ошибка загрузки",
        description: result.error,
        status: "error",
        duration: 5000,
      });
    }
  };

  const handleViewDetails = (receipt) => {
    setSelectedReceipt(receipt);
    onOpen();
  };

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner text="Загрузка чеков..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <Box mb={6}>
        <HStack justifyContent="space-between" mb={6} wrap="wrap" spacing={4}>
          <Box>
            <Heading mb={2}>Чеки</Heading>
            <Text fontSize="sm" color="gray.600">
              Всего чеков: {receipts.length}
            </Text>
          </Box>

          <Box width={{ base: "100%", md: "auto" }}>
            <UploadZone onUpload={handleUpload} uploading={uploading} />
          </Box>
        </HStack>

        {/* Список чеков */}
        <ReceiptsTable receipts={receipts} onViewDetails={handleViewDetails} />

        {/* Модальное окно с деталями */}
        <ReceiptDetailsModal
          isOpen={isOpen}
          onClose={onClose}
          receipt={selectedReceipt}
        />
      </Box>
    </Layout>
  );
};

export default Receipts;
