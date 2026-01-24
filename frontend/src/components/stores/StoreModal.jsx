import React from "react";
import PropTypes from "prop-types";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Button,
  VStack,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  Switch,
  Text,
  Badge,
} from "@chakra-ui/react";

const StoreModal = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  onChange,
  store,
  isLoading = false,
}) => {
  const isEditing = !!store;

  const categories = [
    "Супермаркет",
    "Аптека",
    "Одежда",
    "Электроника",
    "Ресторан/Кафе",
    "Спорттовары",
    "Книги",
    "Другое",
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={handleSubmit}>
        <ModalHeader>
          {isEditing ? "Редактировать магазин" : "Добавить магазин"}
          {store && (
            <Text fontSize="sm" fontWeight="normal" color="gray.500" mt={1}>
              Статистика: {store.receipts_count} чеков,{" "}
              {store.total_spent_rub?.toFixed(2)} ₽ всего
            </Text>
          )}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {store && (
            <VStack align="start" spacing={2} mb={4}>
              <Text fontWeight="bold">{store.retail_name}</Text>
              <Text fontSize="sm">{store.legal_name}</Text>
              {store.inn && <Badge>ИНН: {store.inn}</Badge>}
              {store.address && (
                <Text fontSize="sm" color="gray.600">
                  {store.address}
                </Text>
              )}
            </VStack>
          )}

          <VStack spacing={4}>
            <FormControl>
              <FormLabel>Категория</FormLabel>
              <Select
                name="category"
                value={formData.category}
                onChange={onChange}
                placeholder="Выберите категорию"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl display="flex" alignItems="center">
              <FormLabel mb={0}>Избранный магазин</FormLabel>
              <Switch
                name="is_favorite"
                isChecked={formData.is_favorite}
                onChange={onChange}
                colorScheme="yellow"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Заметки</FormLabel>
              <Textarea
                name="notes"
                value={formData.notes}
                onChange={onChange}
                placeholder="Дополнительная информация, пометки..."
                rows={3}
              />
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose} disabled={isLoading}>
            Отмена
          </Button>
          <Button
            type="submit"
            colorScheme="teal"
            isLoading={isLoading}
            loadingText={isEditing ? "Сохранение..." : "Создание..."}
          >
            {isEditing ? "Сохранить изменения" : "Создать магазин"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

StoreModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  formData: PropTypes.shape({
    category: PropTypes.string,
    is_favorite: PropTypes.bool,
    notes: PropTypes.string,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  store: PropTypes.object,
  isLoading: PropTypes.bool,
};

export default StoreModal;
