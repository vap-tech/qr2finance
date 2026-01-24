import React from "react";
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
} from "@chakra-ui/react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaStore, FaChartLine, FaReceipt, FaChartBar } from "react-icons/fa";

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

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
            <Avatar size="sm" name={user.full_name} />
          </MenuButton>
          <MenuList>
            <MenuItem>{user.email}</MenuItem>
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </MenuList>
        </Menu>
      </Flex>

      <Box p={6}>{children}</Box>
    </Box>
  );
};

export default Layout;
