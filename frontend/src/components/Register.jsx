import React, { useState } from 'react';
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
} from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await authAPI.register({ email, password, full_name: fullName });

      toast({
        title: 'Регистрация успешна',
        description: 'Теперь вы можете войти в систему',
        status: 'success',
        duration: 3000,
      });

      navigate('/login');
    } catch (error) {
      toast({
        title: 'Ошибка регистрации',
        description: error.response?.data?.detail || 'Что-то пошло не так',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxW="md" py={20}>
      <Box
        p={8}
        bg="white"
        borderRadius="lg"
        shadow="lg"
      >
        <VStack spacing={6}>
          <Heading size="lg">Создать аккаунт</Heading>

          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Имя</FormLabel>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Иван Иванов"
                />
              </FormControl>

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
                <FormLabel>Пароль</FormLabel>
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
                loadingText="Регистрация..."
              >
                Зарегистрироваться
              </Button>
            </VStack>
          </form>

          <Text>
            Уже есть аккаунт?{' '}
            <ChakraLink as={Link} to="/login" color="teal.500">
              Войти
            </ChakraLink>
          </Text>
        </VStack>
      </Box>
    </Container>
  );
};

export default Register;