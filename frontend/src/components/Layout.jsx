import React, { useState } from "react";
import {
  Box,
  Flex,
  Heading,
  Button,
  useColorModeValue,
  Spacer,
  Avatar,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  useToast,
  IconButton,
  VStack,
  Text,
} from "@chakra-ui/react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  FaStore,
  FaChartLine,
  FaReceipt,
  FaChartBar,
  FaEllipsisV,
  FaTelegram,
} from "react-icons/fa";
import { useUser } from "../hooks/useUser";
import { userAPI } from "../services/api";

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user, updateUser } = useUser();
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [telegramId, setTelegramId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  const handleOpenTelegramModal = () => {
    setTelegramId(user?.telegram_id || "");
    setIsTelegramModalOpen(true);
  };

  const handleCloseTelegramModal = () => {
    setIsTelegramModalOpen(false);
    setTelegramId("");
  };

  const handleSetTelegramId = async () => {
    // Валидация
    if (!telegramId.match(/^\d+$/)) {
      toast({
        title: "Validation error",
        description: "Telegram ID должен содержать только цифры",
        status: "error",
        duration: 3000,
      });
      return;
    }

    if (telegramId.length < 5 || telegramId.length > 15) {
      toast({
        title: "Validation error",
        description: "Telegram ID должен быть от 5 до 15 цифр",
        status: "error",
        duration: 3000,
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await userAPI.setTelegramId({ telegram_id: telegramId });

      // Обновляем пользователя в хуке и localStorage
      updateUser(response.data);

      toast({
        title: "Success",
        description: "Telegram ID успешно обновлен",
        status: "success",
        duration: 3000,
      });

      handleCloseTelegramModal();
    } catch (error) {
      toast({
        title: "Error",
        description: "Не удалось обновить Telegram ID",
        status: "error",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box minH="100vh" bg={useColorModeValue("gray.50", "gray.900")}>
      <Flex
        as="nav"
        bg={useColorModeValue("white", "gray.800")}
        px={6}
        py={4}
        shadow="sm"
        align="center"
      >
        <Heading size="md" color="teal.500">
          📊 Receipt Analyzer
        </Heading>

        <Flex ml={10} gap={4}>
          <Button
            as={Link}
            to="/dashboard"
            variant={isActive("/dashboard") ? "solid" : "ghost"}
            colorScheme="teal"
            leftIcon={<FaChartLine />}
          >
            Dashboard
          </Button>
          <Button
            as={Link}
            to="/receipts"
            variant={isActive("/receipts") ? "solid" : "ghost"}
            colorScheme="teal"
            leftIcon={<FaReceipt />}
          >
            Receipts
          </Button>
          <Button
            as={Link}
            to="/analytics"
            variant={isActive("/analytics") ? "solid" : "ghost"}
            colorScheme="teal"
            leftIcon={<FaChartBar />}
          >
            Analytics
          </Button>
          <Button
            as={Link}
            to="/stores"
            variant={isActive("/stores") ? "solid" : "ghost"}
            colorScheme="teal"
            leftIcon={<FaStore />}
          >
            Магазины
          </Button>
        </Flex>

        <Spacer />

        <Menu>
          <MenuButton>
            <Avatar size="sm" name={user?.full_name} />
          </MenuButton>
          <MenuList>
            <VStack align="stretch" spacing={2} p={3}>
              <Text fontWeight="bold">{user?.full_name}</Text>
              <Text fontSize="sm" color="gray.600">
                {user?.email}
              </Text>
              {user?.telegram_id && (
                <Flex align="center" justify="space-between">
                  <Flex align="center" gap={2}>
                    <FaTelegram color="#0088cc" />
                    <Text fontSize="sm">Telegram ID: {user.telegram_id}</Text>
                  </Flex>
                  <IconButton
                    size="xs"
                    icon={<FaEllipsisV />}
                    onClick={handleOpenTelegramModal}
                    aria-label="Change Telegram ID"
                  />
                </Flex>
              )}
              {!user?.telegram_id && (
                <Button
                  size="sm"
                  leftIcon={<FaTelegram />}
                  colorScheme="telegram"
                  onClick={handleOpenTelegramModal}
                >
                  Set Telegram ID
                </Button>
              )}
            </VStack>
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </MenuList>
        </Menu>
      </Flex>

      <Box p={6}>{children}</Box>

      {/* Модальное окно для установки Telegram ID */}
      <Modal isOpen={isTelegramModalOpen} onClose={handleCloseTelegramModal}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Set Telegram ID</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>Telegram ID (only digits, 5-15 characters)</FormLabel>
              <Input
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                placeholder="Enter your Telegram ID"
                type="tel"
                pattern="[0-9]*"
              />
            </FormControl>
            <Text fontSize="sm" color="gray.500" mt={2}>
              Current Telegram ID: {user?.telegram_id || "Not set"}
            </Text>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={handleCloseTelegramModal}>
              Cancel
            </Button>
            <Button
              colorScheme="blackAlpha"
              onClick={handleSetTelegramId}
              isLoading={isLoading}
              loadingText="Saving..."
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Layout;
