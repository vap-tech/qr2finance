import React, { useState } from "react";
import {
  Box,
  Container,
  Heading,
  FormControl,
  FormLabel,
  Input,
  Button,
  VStack,
  useToast,
  Text,
  Link as ChakraLink,
} from "@chakra-ui/react";
import { Link, useNavigate } from "react-router-dom";
import { authAPI, userAPI } from "../services/api";
import { useUser } from "../hooks/useUser";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const { saveUser } = useUser();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Логинимся и получаем токен
      const loginResponse = await authAPI.login({ email, password });
      const { access_token } = loginResponse.data;

      // Сохраняем токен
      localStorage.setItem("token", access_token);

      // 2. Получаем данные пользователя
      const userResponse = await userAPI.me();
      const userData = userResponse.data;

      // 3. Сохраняем данные пользователя с telegram_id
      const userToSave = {
        email: userData.email,
        full_name: userData.full_name || email.split("@")[0],
        telegram_id: userData.telegram_id || "",
        id: userData.id,
        is_active: userData.is_active,
        created_at: userData.created_at,
      };

      saveUser(userToSave);

      toast({
        title: "Login successful",
        status: "success",
        duration: 3000,
      });

      navigate("/dashboard");
    } catch (error) {
      // В случае ошибки очищаем токен
      localStorage.removeItem("token");

      toast({
        title: "Login failed",
        description: error.response?.data?.detail || "Invalid credentials",
        status: "error",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxW="md" py={20}>
      <Box p={8} bg="white" borderRadius="lg" shadow="lg">
        <VStack spacing={6}>
          <Heading size="lg">Welcome Back</Heading>

          <form onSubmit={handleSubmit} style={{ width: "100%" }}>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Email</FormLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Password</FormLabel>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                />
              </FormControl>

              <Button
                type="submit"
                colorScheme="teal"
                width="full"
                isLoading={loading}
                loadingText="Logging in..."
              >
                Login
              </Button>
            </VStack>
          </form>

          <Text>
            Don't have an account?{" "}
            <ChakraLink as={Link} to="/register" color="teal.500">
              Register here
            </ChakraLink>
          </Text>
        </VStack>
      </Box>
    </Container>
  );
};

export default Login;
