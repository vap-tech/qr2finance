import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Button,
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
  ModalFooter,
  useDisclosure,
  useToast,
  Spinner,
  Input,
  FormControl,
  FormLabel,
  Textarea,
  Select,
  Switch,
  HStack,
  VStack,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Tag,
} from '@chakra-ui/react';
import {
  FaStore,
  FaEdit,
  FaTrash,
  FaStar,
  FaMapMarkerAlt,
  FaShoppingCart,
  FaEllipsisV,
  FaPlus
} from 'react-icons/fa';
import Layout from './Layout';
import LoadingSpinner from './LoadingSpinner';
import { storesAPI } from '../services/api';

const Stores = () => {
  const [stores, setStores] = useState([]);
  const [storeStats, setStoreStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStore, setEditingStore] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Форма магазина
  const [formData, setFormData] = useState({
    name: '',
    chain_name: '',
    address: '',
    category: '',
    is_favorite: false,
    notes: '',
  });

  // Категории магазинов
  const categories = [
    'Супермаркет',
    'Аптека',
    'Одежда',
    'Электроника',
    'Ресторан/Кафе',
    'Спорттовары',
    'Книги',
    'Другое'
  ];

  // Функция для конвертации копеек в рубли
  const kopecksToRubles = (kopecks) => {
    if (kopecks === null || kopecks === undefined) return 0;
    // Проверяем, если число уже в рублях (больше 1000)
    if (kopecks > 1000) {
      // Если число большое, возможно оно уже в рублях
      // Для примера: 117699.0 - это 1176.99 рублей, значит в копейках должно быть 117699
      // Проверяем логику: если число > 1000, делим на 100
      return Number(kopecks) / 100;
    }
    return Number(kopecks);
  };

  // Функция для форматирования чисел
  const formatCurrency = (value) => {
    const rubles = kopecksToRubles(value);
    return rubles.toFixed(2);
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const [storesRes, statsRes] = await Promise.all([
        storesAPI.getStores(),
        storesAPI.getStoreStats(),
      ]);

      console.log('Stores response:', storesRes.data);
      console.log('Stats response:', statsRes.data);

      // Установка списка магазинов
      setStores(storesRes.data || []);

      // Преобразование статистики магазинов из API
      const formattedStats = (statsRes.data || []).map(store => {
        // Используем новые поля из API
        const storeName = store.name || 'Неизвестный магазин';
        const totalSpent = store.total_spent || 0;
        const receiptsCount = store.receipts_count || 0;
        const avgReceipt = store.avg_receipt || 0;

        // Конвертируем копейки в рубли
        const totalSpentRub = kopecksToRubles(totalSpent);
        const avgReceiptRub = kopecksToRubles(avgReceipt);

        // Если avg_receipt = 0, но есть чеки, рассчитываем средний чек
        const calculatedAvgReceipt = avgReceiptRub === 0 && receiptsCount > 0
          ? totalSpentRub / receiptsCount
          : avgReceiptRub;

        return {
          // Новые поля из API
          name: storeName,
          retail_place: storeName, // Для совместимости с существующим кодом
          total_spent: totalSpent,
          total_spent_rub: totalSpentRub,
          receipts_count: receiptsCount,
          avg_receipt: avgReceipt,
          avg_receipt_rub: calculatedAvgReceipt,
          // Остальные поля
          chain_name: store.chain_name || '',
          address: '',
          first_purchase: null,
          last_purchase: null
        };
      });

      console.log('Formatted stats (в рублях):', formattedStats);
      setStoreStats(formattedStats);

    } catch (error) {
      console.error('Error fetching stores:', error);
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить магазины',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCreateStore = async () => {
    try {
      await storesAPI.createStore(formData);
      toast({
        title: 'Магазин создан',
        status: 'success',
        duration: 3000,
      });
      fetchStores();
      resetForm();
      onClose();
    } catch (error) {
      console.error('Create store error:', error);
      toast({
        title: 'Ошибка',
        description: error.response?.data?.detail || 'Не удалось создать магазин',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleEditStore = (store) => {
    setEditingStore(store);
    setFormData({
      name: store.name || '',
      chain_name: store.chain_name || '',
      address: store.address || '',
      category: store.category || '',
      is_favorite: store.is_favorite || false,
      notes: store.notes || '',
    });
    onOpen();
  };

  const handleUpdateStore = async () => {
    if (!editingStore) return;

    try {
      await storesAPI.updateStore(editingStore.store_id, formData);
      toast({
        title: 'Магазин обновлен',
        status: 'success',
        duration: 3000,
      });
      fetchStores();
      resetForm();
      onClose();
    } catch (error) {
      console.error('Update store error:', error);
      toast({
        title: 'Ошибка',
        description: error.response?.data?.detail || 'Не удалось обновить магазин',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleDeleteStore = async (storeId) => {
    if (!window.confirm('Удалить магазин? Все связанные чеки останутся без привязки.')) {
      return;
    }

    try {
      await storesAPI.deleteStore(storeId);
      toast({
        title: 'Магазин удален',
        status: 'success',
        duration: 3000,
      });
      fetchStores();
    } catch (error) {
      console.error('Delete store error:', error);
      toast({
        title: 'Ошибка',
        description: error.response?.data?.detail || 'Не удалось удалить магазин',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      chain_name: '',
      address: '',
      category: '',
      is_favorite: false,
      notes: '',
    });
    setEditingStore(null);
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
          <FaStore style={{ display: 'inline', marginRight: '10px' }} />
          Магазины
        </Heading>
        <Button
          leftIcon={<FaPlus />}
          colorScheme="teal"
          onClick={() => {
            resetForm();
            onOpen();
          }}
        >
          Добавить магазин
        </Button>
      </HStack>

      <Box mb={8}>
        <Heading size="md" mb={4}>Статистика по магазинам (из чеков)</Heading>
        {storeStats.length > 0 ? (
          <Box
            bg="white"
            borderRadius="lg"
            shadow="sm"
            overflow="hidden"
          >
            <Table variant="simple">
              <Thead bg="gray.50">
                <Tr>
                  <Th>Магазин</Th>
                  <Th isNumeric>Чеков</Th>
                  <Th isNumeric>Потрачено</Th>
                  <Th isNumeric>Ср. чек</Th>
                </Tr>
              </Thead>
              <Tbody>
                {storeStats.map((store, index) => {
                  // Безопасное получение значений
                  const totalSpent = store.total_spent_rub || 0;
                  const avgReceipt = store.avg_receipt_rub || 0;
                  const storeName = store.name || store.retail_place || 'Неизвестный магазин';

                  return (
                    <Tr key={`${storeName}-${index}`} _hover={{ bg: 'gray.50' }}>
                      <Td>
                        <VStack align="start" spacing={1}>
                          <Text fontWeight="medium">{storeName}</Text>
                          {store.chain_name && (
                            <Tag size="sm" colorScheme="blue">
                              {store.chain_name}
                            </Tag>
                          )}
                          {store.address && (
                            <Text fontSize="xs" color="gray.600">
                              <FaMapMarkerAlt style={{ display: 'inline', marginRight: '4px' }} />
                              {store.address}
                            </Text>
                          )}
                        </VStack>
                      </Td>
                      <Td isNumeric>{store.receipts_count || 0}</Td>
                      <Td isNumeric>{totalSpent.toFixed(2)} ₽</Td>
                      <Td isNumeric>{avgReceipt.toFixed(2)} ₽</Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        ) : (
          <Box textAlign="center" py={8} bg="gray.50" borderRadius="lg">
            <Text color="gray.500">Нет статистики по магазинам</Text>
            <Text fontSize="sm" color="gray.400" mt={2}>
              Загрузите чеки чтобы увидеть статистику
            </Text>
          </Box>
        )}
      </Box>

      <Box>
        <Heading size="md" mb={4}>Мои магазины (добавленные вручную)</Heading>
        {stores.length > 0 ? (
          <Box
            display="grid"
            gridTemplateColumns="repeat(auto-fill, minmax(300px, 1fr))"
            gap={4}
          >
            {stores.map((store) => (
              <Box
                key={store.store_id}
                p={4}
                bg="white"
                borderRadius="lg"
                shadow="sm"
                border="1px solid"
                borderColor="gray.200"
              >
                <HStack justifyContent="space-between" mb={2}>
                  <HStack>
                    <FaStore color={store.is_favorite ? '#F6AD55' : '#718096'} />
                    <Text fontWeight="bold">{store.name}</Text>
                    {store.is_favorite && <FaStar color="#F6AD55" />}
                  </HStack>
                  <Menu>
                    <MenuButton
                      as={IconButton}
                      icon={<FaEllipsisV />}
                      variant="ghost"
                      size="sm"
                    />
                    <MenuList>
                      <MenuItem icon={<FaEdit />} onClick={() => handleEditStore(store)}>
                        Редактировать
                      </MenuItem>
                      <MenuItem icon={<FaTrash />} onClick={() => handleDeleteStore(store.store_id)}>
                        Удалить
                      </MenuItem>
                    </MenuList>
                  </Menu>
                </HStack>

                {store.chain_name && (
                  <Tag size="sm" colorScheme="blue" mb={2}>
                    {store.chain_name}
                  </Tag>
                )}

                {store.category && (
                  <Tag size="sm" colorScheme="green" mb={2} ml={store.chain_name ? 2 : 0}>
                    {store.category}
                  </Tag>
                )}

                {store.address && (
                  <Text fontSize="sm" color="gray.600" mb={2}>
                    <FaMapMarkerAlt style={{ display: 'inline', marginRight: '6px' }} />
                    {store.address}
                  </Text>
                )}

                {store.notes && (
                  <Text fontSize="sm" color="gray.500">
                    {store.notes}
                  </Text>
                )}
              </Box>
            ))}
          </Box>
        ) : (
          <Box textAlign="center" py={8} bg="gray.50" borderRadius="lg">
            <Text color="gray.500">Пока нет добавленных магазинов</Text>
            <Text fontSize="sm" color="gray.400" mt={2}>
              Добавьте магазин вручную для удобного управления
            </Text>
            <Button
              mt={4}
              leftIcon={<FaPlus />}
              colorScheme="teal"
              size="sm"
              onClick={() => {
                resetForm();
                onOpen();
              }}
            >
              Добавить первый магазин
            </Button>
          </Box>
        )}
      </Box>

      {/* Модальное окно создания/редактирования магазина */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {editingStore ? 'Редактировать магазин' : 'Добавить магазин'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Название магазина</FormLabel>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Например: Пятерочка"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Название сети</FormLabel>
                <Input
                  name="chain_name"
                  value={formData.chain_name}
                  onChange={handleInputChange}
                  placeholder="Например: X5 Retail Group"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Адрес</FormLabel>
                <Textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Полный адрес магазина"
                  rows={2}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Категория</FormLabel>
                <Select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  placeholder="Выберите категорию"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </Select>
              </FormControl>

              <FormControl display="flex" alignItems="center">
                <FormLabel mb={0}>Избранный магазин</FormLabel>
                <Switch
                  name="is_favorite"
                  isChecked={formData.is_favorite}
                  onChange={handleInputChange}
                  colorScheme="yellow"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Заметки</FormLabel>
                <Textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Дополнительная информация"
                  rows={3}
                />
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => {
              resetForm();
              onClose();
            }}>
              Отмена
            </Button>
            <Button
              colorScheme="teal"
              onClick={editingStore ? handleUpdateStore : handleCreateStore}
            >
              {editingStore ? 'Сохранить' : 'Создать'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Layout>
  );
};

export default Stores;