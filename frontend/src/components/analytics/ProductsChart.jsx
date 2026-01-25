import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Card,
  CardBody,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82ca9d",
  "#d0ed57",
  "#a4de6c",
];

const ProductsChart = ({ products }) => {
  // ВСЕ ХУКИ НА ВЕРХНЕМ УРОВНЕ
  const tooltipBg = useColorModeValue("white", "gray.800");
  const tooltipBorder = useColorModeValue("gray.200", "gray.700");
  const gridStroke = useColorModeValue("#e5e7eb", "#374151");
  const axisStroke = useColorModeValue("#6b7280", "#9ca3af");

  const chartData = products.slice(0, 8).map((product) => ({
    ...product,
    name:
      product.name.length > 15
        ? `${product.name.substring(0, 15)}...`
        : product.name,
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const product = payload[0].payload;
      return (
        <Box
          bg={tooltipBg}
          p={3}
          borderRadius="md"
          shadow="lg"
          border="1px solid"
          borderColor={tooltipBorder}
        >
          <Text fontWeight="bold" mb={1}>
            {product.fullName || product.name}
          </Text>
          <Text fontSize="sm">
            Потрачено: <strong>{product.totalAmount.toFixed(2)} ₽</strong>
          </Text>
          <Text fontSize="sm">
            Количество:{" "}
            <strong>
              {product.quantity} {product.measure}
            </strong>
          </Text>
          {product.category && (
            <Text fontSize="sm">
              Категория: <strong>{product.category}</strong>
            </Text>
          )}
        </Box>
      );
    }
    return null;
  };

  if (products.length === 0) {
    return (
      <Card>
        <CardBody>
          <Heading size="sm" mb={4}>
            Топ товаров
          </Heading>
          <Box
            height="300px"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Text color="gray.500">Нет данных о товарах</Text>
          </Box>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <Heading size="sm" mb={4}>
          Топ товаров по расходам
        </Heading>

        <Box height="300px" mb={6}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                type="number"
                tickFormatter={(value) => `${value.toFixed(0)} ₽`}
                stroke={axisStroke}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={80}
                tick={{ fontSize: 12 }}
                stroke={axisStroke}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="totalAmount" name="Потрачено" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>

        {products.length > 0 && (
          <Box overflowX="auto">
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>Товар</Th>
                  <Th isNumeric>Количество</Th>
                  <Th isNumeric>Сумма</Th>
                  <Th>Категория</Th>
                </Tr>
              </Thead>
              <Tbody>
                {products.slice(0, 5).map((product) => (
                  <Tr key={product.id}>
                    <Td
                      maxWidth="200px"
                      overflow="hidden"
                      textOverflow="ellipsis"
                    >
                      {product.name}
                    </Td>
                    <Td isNumeric>
                      {product.quantity} {product.measure}
                    </Td>
                    <Td isNumeric fontWeight="bold">
                      {product.totalAmount.toFixed(2)} ₽
                    </Td>
                    <Td>
                      <Text fontSize="xs" color="gray.500">
                        {product.category}
                      </Text>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </CardBody>
    </Card>
  );
};

ProductsChart.propTypes = {
  products: PropTypes.array.isRequired,
};

export default ProductsChart;
