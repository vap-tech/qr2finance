import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Text,
  Tag,
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from "@chakra-ui/react";
import {
  FaStore,
  FaStar,
  FaMapMarkerAlt,
  FaEdit,
  FaTrash,
  FaEllipsisV,
} from "react-icons/fa";

const StoreCard = ({ store, onEdit, onDelete }) => {
  return (
    <Box
      p={4}
      bg="white"
      borderRadius="lg"
      shadow="sm"
      border="1px solid"
      borderColor="gray.200"
      _hover={{ shadow: "md" }}
      transition="all 0.2s"
    >
      <HStack justifyContent="space-between" mb={2}>
        <HStack>
          <FaStore color={store.is_favorite ? "#F6AD55" : "#718096"} />
          <Text fontWeight="bold">{store.name}</Text>
          {store.is_favorite && <FaStar color="#F6AD55" />}
        </HStack>
        <Menu>
          <MenuButton
            as={IconButton}
            icon={<FaEllipsisV />}
            variant="ghost"
            size="sm"
            aria-label="Действия с магазином"
          />
          <MenuList>
            <MenuItem icon={<FaEdit />} onClick={() => onEdit(store)}>
              Редактировать
            </MenuItem>
            <MenuItem
              icon={<FaTrash />}
              onClick={() => onDelete(store.store_id)}
              color="red.500"
            >
              Удалить
            </MenuItem>
          </MenuList>
        </Menu>
      </HStack>

      <HStack mb={2} wrap="wrap" spacing={2}>
        {store.chain_name && (
          <Tag size="sm" colorScheme="blue">
            {store.chain_name}
          </Tag>
        )}
        {store.category && (
          <Tag size="sm" colorScheme="green">
            {store.category}
          </Tag>
        )}
      </HStack>

      {store.address && (
        <Text fontSize="sm" color="gray.600" mb={2}>
          <FaMapMarkerAlt style={{ display: "inline", marginRight: "6px" }} />
          {store.address}
        </Text>
      )}

      {store.notes && (
        <Text fontSize="sm" color="gray.500" mt={2}>
          {store.notes}
        </Text>
      )}
    </Box>
  );
};

StoreCard.propTypes = {
  store: PropTypes.shape({
    store_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
      .isRequired,
    name: PropTypes.string.isRequired,
    chain_name: PropTypes.string,
    category: PropTypes.string,
    address: PropTypes.string,
    is_favorite: PropTypes.bool,
    notes: PropTypes.string,
  }).isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default StoreCard;
