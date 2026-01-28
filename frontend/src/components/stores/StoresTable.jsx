import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  Tag,
  VStack,
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Badge,
  useColorModeValue,
} from "@chakra-ui/react";
import {
  FaMapMarkerAlt,
  FaEdit,
  FaTrash,
  FaStar,
  FaRegStar,
  FaEllipsisV,
} from "react-icons/fa";
import EmptyState from "../shared/EmptyState";

const StoresTable = ({
  stores,
  onEdit,
  onDelete,
  onToggleFavorite,
  isLoading = false,
}) => {
  const rowHoverBg = useColorModeValue("gray.50", "gray.700");

  if (stores.length === 0) {
    return (
      <EmptyState
        title="Нет данных о магазинах"
        description="Загрузите чеки, чтобы увидеть статистику магазинов"
      />
    );
  }

  const handleFavoriteClick = (storeId, isFavorite) => {
    if (onToggleFavorite) {
      onToggleFavorite(storeId, !isFavorite);
    }
  };

  return (
    <Box
      bg={useColorModeValue("white", "gray.800")}
      borderRadius="lg"
      shadow="sm"
      overflow="hidden"
    >
      <Table variant="simple">
        <Thead bg={useColorModeValue("gray.50", "gray.700")}>
          <Tr>
            <Th>Магазин</Th>
            <Th>Юр. название</Th>
            <Th isNumeric>Чеков</Th>
            <Th isNumeric>Потрачено</Th>
            <Th isNumeric>Ср. чек</Th>
            <Th>🛠</Th>
          </Tr>
        </Thead>
        <Tbody>
          {stores.map((store) => (
            <Tr
              key={store.id}
              _hover={{ bg: rowHoverBg }}
              transition="background-color 0.2s"
            >
              <Td>
                <VStack align="start" spacing={1}>
                  <HStack>
                    <Text fontWeight="medium">{store.retail_name}</Text>
                    <IconButton
                      icon={store.is_favorite ? <FaStar /> : <FaRegStar />}
                      size="xs"
                      variant="ghost"
                      color={store.is_favorite ? "yellow.400" : "gray.400"}
                      onClick={() =>
                        handleFavoriteClick(store.id, store.is_favorite)
                      }
                      aria-label={
                        store.is_favorite
                          ? "Убрать из избранного"
                          : "Добавить в избранное"
                      }
                      isLoading={isLoading}
                    />
                  </HStack>

                  {store.address && (
                    <Text fontSize="xs" color="gray.600">
                      <FaMapMarkerAlt
                        style={{ display: "inline", marginRight: "4px" }}
                      />
                      {store.address}
                    </Text>
                  )}

                  {store.inn && (
                    <Badge fontSize="xs" colorScheme="gray">
                      ИНН: {store.inn}
                    </Badge>
                  )}

                  {store.category && (
                    <Tag size="sm" colorScheme="blue" mt={1}>
                      {store.category}
                    </Tag>
                  )}
                </VStack>
              </Td>

              <Td>
                <Text fontSize="sm">{store.legal_name}</Text>
                {store.notes && (
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    {store.notes}
                  </Text>
                )}
              </Td>

              <Td isNumeric>
                <Text fontWeight="medium">{store.receipts_count}</Text>
              </Td>

              <Td isNumeric>
                <Text fontWeight="bold" color="green.600">
                  {store.total_spent_rub.toFixed(2)}
                </Text>
              </Td>

              <Td isNumeric>
                <Text fontWeight="bold" color="blue.600">
                  {store.avg_receipt_rub.toFixed(2)}
                </Text>
              </Td>

              <Td>
                <Menu>
                  <MenuButton
                    as={IconButton}
                    icon={<FaEllipsisV />}
                    variant="ghost"
                    size="sm"
                    isLoading={isLoading}
                    aria-label="Действия с магазином"
                  />
                  <MenuList>
                    <MenuItem
                      icon={<FaEdit />}
                      onClick={() => onEdit(store)}
                      isDisabled={isLoading}
                    >
                      Редактировать
                    </MenuItem>
                    <MenuItem
                      icon={<FaTrash />}
                      onClick={() => onDelete(store.id)}
                      color="red.500"
                      isDisabled={isLoading}
                    >
                      Удалить
                    </MenuItem>
                  </MenuList>
                </Menu>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
};

StoresTable.propTypes = {
  stores: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      retail_name: PropTypes.string.isRequired,
      legal_name: PropTypes.string.isRequired,
      total_spent_rub: PropTypes.number.isRequired,
      receipts_count: PropTypes.number.isRequired,
      avg_receipt_rub: PropTypes.number.isRequired,
      inn: PropTypes.string,
      address: PropTypes.string,
      category: PropTypes.string,
      is_favorite: PropTypes.bool,
      notes: PropTypes.string,
    }),
  ).isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onToggleFavorite: PropTypes.func,
  isLoading: PropTypes.bool,
};

export default StoresTable;
