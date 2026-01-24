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
import EmptyState from "../shared/EmptyState";
import ConfirmDialog from "../shared/ConfirmDialog";
import StoreStatsTable from "./StoreStatsTable";
import StoreCard from "./StoreCard";
import StoreModal from "./StoreModal";
import { useStores } from "../../hooks/useStores";

const Stores = () => {
  const {
    stores,
    storeStats,
    loading,
    error,
    fetchStores,
    createStore,
    updateStore,
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

  const [editingStore, setEditingStore] = useState(null);
  const [deletingStoreId, setDeletingStoreId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toast = useToast();

  const [formData, setFormData] = useState({
    name: "",
    chain_name: "",
    address: "",
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

  const handleOpenModal = (store = null) => {
    if (store) {
      setEditingStore(store);
      setFormData({
        name: store.name || "",
        chain_name: store.chain_name || "",
        address: store.address || "",
        category: store.category || "",
        is_favorite: store.is_favorite || false,
        notes: store.notes || "",
      });
    } else {
      setEditingStore(null);
      setFormData({
        name: "",
        chain_name: "",
        address: "",
        category: "",
        is_favorite: false,
        notes: "",
      });
    }
    onModalOpen();
  };

  const handleSubmitStore = async () => {
    setIsSubmitting(true);
    try {
      const result = editingStore
        ? await updateStore(editingStore.store_id, formData)
        : await createStore(formData);

      if (result.success) {
        toast({
          title: editingStore ? "Магазин обновлен" : "Магазин создан",
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
        <Button
          leftIcon={<FaPlus />}
          colorScheme="teal"
          onClick={() => handleOpenModal()}
        >
          Добавить магазин
        </Button>
      </HStack>

      {/* Статистика по магазинам из чеков */}
      <Box mb={8}>
        <Heading size="md" mb={4}>
          Статистика по магазинам (из чеков)
        </Heading>
        <StoreStatsTable stats={storeStats} />
      </Box>

      {/* Мои магазины (добавленные вручную) */}
      <Box>
        <Heading size="md" mb={4}>
          Мои магазины (добавленные вручную)
        </Heading>
        {stores.length > 0 ? (
          <Box
            display="grid"
            gridTemplateColumns="repeat(auto-fill, minmax(300px, 1fr))"
            gap={4}
          >
            {stores.map((store) => (
              <StoreCard
                key={store.store_id}
                store={store}
                onEdit={() => handleOpenModal(store)}
                onDelete={handleDeleteClick}
              />
            ))}
          </Box>
        ) : (
          <EmptyState
            title="Пока нет добавленных магазинов"
            description="Добавьте магазин вручную для удобного управления"
          >
            <Button
              mt={4}
              leftIcon={<FaPlus />}
              colorScheme="teal"
              size="sm"
              onClick={() => handleOpenModal()}
            >
              Добавить первый магазин
            </Button>
          </EmptyState>
        )}
      </Box>

      {/* Модальное окно создания/редактирования */}
      <StoreModal
        isOpen={isModalOpen}
        onClose={onModalClose}
        onSubmit={handleSubmitStore}
        formData={formData}
        onChange={handleInputChange}
        isEditing={!!editingStore}
        isLoading={isSubmitting}
      />

      {/* Диалог подтверждения удаления */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={onConfirmClose}
        onConfirm={handleConfirmDelete}
        title="Удалить магазин?"
        message="Все связанные чеки останутся без привязки."
        confirmText="Удалить"
        cancelText="Отмена"
        confirmColor="red"
      />
    </Layout>
  );
};

export default Stores;
