
import axiosInstance from "../axiosInstance";

export async function getApiHealth() {
  const response = await axiosInstance.get("/health");
  return response.data;
}
