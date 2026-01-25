import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Card,
  CardBody,
  Heading,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const MonthlyChart = ({ data, year }) => {
  // ВСЕ ХУКИ НА ВЕРХНЕМ УРОВНЕ
  const tooltipBg = useColorModeValue("white", "gray.800");
  const tooltipBorder = useColorModeValue("gray.200", "gray.700");
  const gridStroke = useColorModeValue("#e5e7eb", "#374151");
  const axisStroke = useColorModeValue("#6b7280", "#9ca3af");

  // Подготавливаем данные
  const chartData = data.map((item) => ({
    ...item,
    name: item.monthName,
    Сумма: item.totalAmount,
    Чеки: item.receiptsCount,
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
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
            {label} {year}
          </Text>
          {payload.map((entry, index) => (
            <Text key={index} fontSize="sm" color={entry.color}>
              {entry.dataKey}:{" "}
              {entry.dataKey === "Сумма"
                ? `${entry.value.toFixed(2)} ₽`
                : entry.value}
            </Text>
          ))}
        </Box>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardBody>
          <Heading size="sm" mb={4}>
            Динамика расходов
          </Heading>
          <Box
            height="300px"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Text color="gray.500">Нет данных за выбранный период</Text>
          </Box>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <Heading size="sm" mb={4}>
          Динамика расходов ({year} год)
        </Heading>
        <Box height="300px">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="name" stroke={axisStroke} />
              <YAxis
                stroke={axisStroke}
                tickFormatter={(value) => value.toFixed(0)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="Сумма"
                stroke="#8884d8"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name="Сумма расходов"
              />
              {data.some((item) => item.receiptsCount > 0) && (
                <Line
                  type="monotone"
                  dataKey="Чеки"
                  stroke="#82ca9d"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Количество чеков"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </CardBody>
    </Card>
  );
};

MonthlyChart.propTypes = {
  data: PropTypes.array.isRequired,
  year: PropTypes.number.isRequired,
};

export default MonthlyChart;
