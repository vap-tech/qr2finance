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
} from "@chakra-ui/react";

const StoreModal = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  onChange,
  isEditing,
  categories = [],
  isLoading = false,
}) => {
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
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel>Название магазина</FormLabel>
              <Input
                name="name"
                value={formData.name}
                onChange={onChange}
                placeholder="Например: Пятерочка"
                required
              />
            </FormControl>

            <FormControl>
              <FormLabel>Название сети</FormLabel>
              <Input
                name="chain_name"
                value={formData.chain_name}
                onChange={onChange}
                placeholder="Например: X5 Retail Group"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Адрес</FormLabel>
              <Textarea
                name="address"
                value={formData.address}
                onChange={onChange}
                placeholder="Полный адрес магазина"
                rows={2}
              />
            </FormControl>

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
                placeholder="Дополнительная информация"
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
            {isEditing ? "Сохранить" : "Создать"}
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
    name: PropTypes.string,
    chain_name: PropTypes.string,
    address: PropTypes.string,
    category: PropTypes.string,
    is_favorite: PropTypes.bool,
    notes: PropTypes.string,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  isEditing: PropTypes.bool,
  categories: PropTypes.arrayOf(PropTypes.string),
  isLoading: PropTypes.bool,
};

StoreModal.defaultProps = {
  categories: [
    "Супермаркет",
    "Аптека",
    "Одежда",
    "Электроника",
    "Ресторан/Кафе",
    "Спорттовары",
    "Книги",
    "Другое",
  ],
};

export default StoreModal;
