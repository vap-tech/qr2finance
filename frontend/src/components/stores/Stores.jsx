import React, { useState } from "react";
import {
  Box,
  Heading,
  Button,
  useDisclosure,
  useToast,
  HStack,
} from "@chakra-ui/react";
import { FaStore, FaPlus } from "react-icons/fa";
import Layout from "../Layout";
import LoadingSpinner from "../shared/LoadingSpinner";
import StoresTable from "./StoresTable";
import StoreFilters from "./StoreFilters";
import StoreModal from "./StoreModal";
import ConfirmDialog from "../shared/ConfirmDialog";
import { useStores } from "../../hooks/useStores";

const Stores = () => {
  const {
    stores,
    loading,
    sortConfig,
    totalStores,
    fetchStores,
    updateSortConfig,
    updateStore,
    toggleFavorite,
    deleteStore,
  } = useStores();

  const {
    isOpen: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure();
  const {
    isOpen: isConfirmOpen,
    onOpen: onConfirmOpen,
    onClose: onConfirmClose,
  } = useDisclosure();

  const [selectedStore, setSelectedStore] = useState(null);
  const [deletingStoreId, setDeletingStoreId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toast = useToast();

  const [formData, setFormData] = useState({
    category: "",
    is_favorite: false,
    notes: "",
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleEditClick = (store) => {
    setSelectedStore(store);
    setFormData({
      category: store.category || "",
      is_favorite: store.is_favorite || false,
      notes: store.notes || "",
    });
    onModalOpen();
  };

  const handleAddClick = () => {
    setSelectedStore(null);
    setFormData({
      category: "",
      is_favorite: false,
      notes: "",
    });
    onModalOpen();
  };

  const handleSubmitStore = async () => {
    setIsSubmitting(true);
    try {
      const result = selectedStore
        ? await updateStore(selectedStore.id, formData)
        : { success: false, error: "Добавление магазинов пока не реализовано" };

      if (result.success) {
        toast({
          title: "Магазин обновлен",
          status: "success",
          duration: 3000,
        });
        onModalClose();
      } else {
        toast({
          title: "Ошибка",
          description: result.error,
          status: "error",
          duration: 5000,
        });
      }
    } catch (err) {
      toast({
        title: "Ошибка",
        description: "Произошла непредвиденная ошибка",
        status: "error",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (storeId) => {
    setDeletingStoreId(storeId);
    onConfirmOpen();
  };

  const handleConfirmDelete = async () => {
    if (!deletingStoreId) return;

    const result = await deleteStore(deletingStoreId);
    if (result.success) {
      toast({
        title: "Магазин удален",
        status: "success",
        duration: 3000,
      });
    } else {
      toast({
        title: "Ошибка",
        description: result.error,
        status: "error",
        duration: 5000,
      });
    }

    setDeletingStoreId(null);
    onConfirmClose();
  };

  const handleToggleFavorite = async (storeId, isFavorite) => {
    const result = await toggleFavorite(storeId, isFavorite);
    if (result.success) {
      toast({
        title: isFavorite ? "Добавлено в избранное" : "Убрано из избранного",
        status: "success",
        duration: 2000,
      });
    } else {
      toast({
        title: "Ошибка",
        description: result.error,
        status: "error",
        duration: 3000,
      });
    }
  };

  const handleSortChange = (newSort) => {
    updateSortConfig(newSort);
  };

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner text="Загрузка магазинов..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <HStack justifyContent="space-between" mb={6}>
        <Heading size="xl">
          <FaStore style={{ display: "inline", marginRight: "10px" }} />
          Магазины
        </Heading>
        {/* Кнопку добавления можно убрать или оставить для будущей функциональности */}
        {/* <Button leftIcon={<FaPlus />} colorScheme="teal" onClick={handleAddClick}>
          Добавить магазин
        </Button> */}
      </HStack>

      <StoreFilters
        sortConfig={{ ...sortConfig, totalStores }}
        onSortChange={handleSortChange}
      />

      <StoresTable
        stores={stores}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
        onToggleFavorite={handleToggleFavorite}
        isLoading={isSubmitting}
      />

      {/* Модальное окно редактирования */}
      <StoreModal
        isOpen={isModalOpen}
        onClose={onModalClose}
        onSubmit={handleSubmitStore}
        formData={formData}
        onChange={handleInputChange}
        store={selectedStore}
        isLoading={isSubmitting}
      />

      {/* Диалог подтверждения удаления */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={onConfirmClose}
        onConfirm={handleConfirmDelete}
        title="Удалить магазин?"
        message="Вы уверены, что хотите удалить магазин? Это действие нельзя отменить."
        confirmText="Удалить"
        cancelText="Отмена"
        confirmColor="red"
      />
    </Layout>
  );
};

export default Stores;
